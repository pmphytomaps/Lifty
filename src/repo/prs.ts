import { getDb, type SqlDriver } from '../db/database';
import { epley1Rm } from '../lib/calories';
import type { PrKind } from './types';

interface SetMetric { kind: PrKind; value: number; setId: number }

export function metricsForSet(s: {
  id: number; weight_kg: number | null; reps: number | null; duration_s: number | null;
}, category: 'strength' | 'cardio'): SetMetric[] {
  const out: SetMetric[] = [];
  if (category === 'cardio') {
    if (s.duration_s && s.duration_s > 0) out.push({ kind: 'duration', value: s.duration_s, setId: s.id });
    return out;
  }
  const w = s.weight_kg ?? 0;
  const r = s.reps ?? 0;
  if (w > 0 && r > 0) {
    out.push({ kind: 'weight', value: w, setId: s.id });
    out.push({ kind: 'e1rm', value: Math.round(epley1Rm(w, r) * 10) / 10, setId: s.id });
    out.push({ kind: 'set_volume', value: Math.round(w * r * 10) / 10, setId: s.id });
    out.push({ kind: 'reps', value: r, setId: s.id });
  }
  return out;
}

export async function currentBest(exerciseId: string, kind: PrKind, db: SqlDriver = getDb()): Promise<number> {
  const row = await db.get<{ v: number | null }>(
    `SELECT MAX(value) AS v FROM personal_record WHERE exercise_id = ? AND kind = ?`,
    [exerciseId, kind],
  );
  return row?.v ?? 0;
}

export interface PrCandidate { exerciseId: string; kind: PrKind; value: number; setId: number; prior: number }

/** Best candidate per (exercise, kind) in a workout that beats stored history. */
export async function collectPrCandidates(workoutId: number, db: SqlDriver = getDb()): Promise<PrCandidate[]> {
  const sets = await db.all<{
    id: number; weight_kg: number | null; reps: number | null; duration_s: number | null;
    exercise_id: string; category: 'strength' | 'cardio'; completed_at: number | null;
  }>(
    `SELECT ws.id, ws.weight_kg, ws.reps, ws.duration_s, ws.completed_at, we.exercise_id, e.category
     FROM workout_set ws
     JOIN workout_exercise we ON we.id = ws.workout_exercise_id
     JOIN exercise e ON e.id = we.exercise_id
     WHERE we.workout_id = ? AND ws.is_completed = 1
     ORDER BY ws.id`,
    [workoutId],
  );
  const best = new Map<string, SetMetric & { exerciseId: string }>();
  for (const s of sets) {
    for (const m of metricsForSet(s, s.category)) {
      const key = `${s.exercise_id}|${m.kind}`;
      const cur = best.get(key);
      if (!cur || m.value > cur.value) best.set(key, { ...m, exerciseId: s.exercise_id });
    }
  }
  const out: PrCandidate[] = [];
  for (const m of best.values()) {
    const prior = await currentBest(m.exerciseId, m.kind, db);
    // Exclude PR rows this same workout wrote earlier (re-finish after editing).
    const own = await db.get<{ v: number | null }>(
      `SELECT MAX(value) AS v FROM personal_record WHERE exercise_id = ? AND kind = ? AND workout_id = ?`,
      [m.exerciseId, m.kind, workoutId],
    );
    const priorOutside = own?.v != null && own.v >= prior ? await priorExcluding(m.exerciseId, m.kind, workoutId, db) : prior;
    if (m.value > priorOutside) {
      out.push({ exerciseId: m.exerciseId, kind: m.kind, value: m.value, setId: m.setId, prior: priorOutside });
    }
  }
  return out;
}

async function priorExcluding(exerciseId: string, kind: PrKind, workoutId: number, db: SqlDriver): Promise<number> {
  const row = await db.get<{ v: number | null }>(
    `SELECT MAX(value) AS v FROM personal_record WHERE exercise_id = ? AND kind = ? AND workout_id != ?`,
    [exerciseId, kind, workoutId],
  );
  return row?.v ?? 0;
}

/**
 * Detect and store PRs for a finished workout. Returns the number of PR rows created.
 * First-ever lifts count as records (there was nothing before them).
 */
export async function detectPrsForWorkout(workoutId: number, db: SqlDriver = getDb()): Promise<number> {
  const candidates = await collectPrCandidates(workoutId, db);
  const w = await db.get<{ started_at: number; finished_at: number | null }>(
    `SELECT started_at, finished_at FROM workout WHERE id = ?`, [workoutId],
  );
  // Stamp records with when the session HAPPENED, not when it was closed. This is
  // what a re-date writes too, so moving a workout keeps its records aligned.
  const achievedAt = w?.started_at ?? w?.finished_at ?? Date.now();
  await db.run(`DELETE FROM personal_record WHERE workout_id = ?`, [workoutId]);
  for (const m of candidates) {
    await db.run(
      `INSERT INTO personal_record (exercise_id, workout_set_id, workout_id, kind, value, achieved_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [m.exerciseId, m.setId, workoutId, m.kind, m.value, achievedAt],
    );
  }
  return candidates.length;
}

/** Full rebuild after editing or deleting history: replays finished workouts in order. */
export async function rebuildAllPrs(db: SqlDriver = getDb()): Promise<void> {
  await db.transaction(async () => {
    await db.run(`DELETE FROM personal_record`);
    const workouts = await db.all<{ id: number }>(
      `SELECT id FROM workout WHERE finished_at IS NOT NULL ORDER BY finished_at ASC, id ASC`,
    );
    for (const w of workouts) {
      const n = await detectPrsForWorkout(w.id, db);
      await db.run(`UPDATE workout SET pr_count = ? WHERE id = ?`, [n, w.id]);
    }
  });
}

export interface PrRow {
  id: number; exercise_id: string; exercise_name: string; kind: PrKind; value: number; achieved_at: number;
}

export async function recentPrs(limit = 20): Promise<PrRow[]> {
  return getDb().all<PrRow>(
    `SELECT pr.id, pr.exercise_id, e.name AS exercise_name, pr.kind, pr.value, pr.achieved_at
     FROM personal_record pr JOIN exercise e ON e.id = pr.exercise_id
     ORDER BY pr.achieved_at DESC, pr.id DESC LIMIT ?`,
    [limit],
  );
}

export async function bestsForExercise(exerciseId: string): Promise<Partial<Record<PrKind, { value: number; achieved_at: number }>>> {
  const rows = await getDb().all<{ kind: PrKind; value: number; achieved_at: number }>(
    `SELECT kind, value, achieved_at FROM personal_record pr1
     WHERE exercise_id = ? AND value = (
       SELECT MAX(value) FROM personal_record pr2 WHERE pr2.exercise_id = pr1.exercise_id AND pr2.kind = pr1.kind
     ) GROUP BY kind`,
    [exerciseId],
  );
  const out: Partial<Record<PrKind, { value: number; achieved_at: number }>> = {};
  for (const r of rows) out[r.kind] = { value: r.value, achieved_at: r.achieved_at };
  return out;
}
