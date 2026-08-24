import { getDb, type SqlDriver } from '../db/database';
import { workoutKcal } from '../lib/calories';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from './types';
import { detectPrsForWorkout } from './prs';
import { getRoutineDetail } from './routines';

export interface WorkoutListRow extends Workout { }

export async function listFinishedWorkouts(limit: number, offset = 0): Promise<WorkoutListRow[]> {
  return getDb().all<WorkoutListRow>(
    `SELECT * FROM workout WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
}

export async function workoutsBetween(fromMs: number, toMs: number): Promise<WorkoutListRow[]> {
  return getDb().all<WorkoutListRow>(
    `SELECT * FROM workout WHERE finished_at IS NOT NULL AND started_at >= ? AND started_at < ? ORDER BY started_at ASC`,
    [fromMs, toMs],
  );
}

export interface WorkoutDetail {
  workout: Workout;
  exercises: (WorkoutExercise & { exercise: Exercise; sets: WorkoutSet[] })[];
}

export async function getWorkoutDetail(id: number, db: SqlDriver = getDb()): Promise<WorkoutDetail | null> {
  const workout = await db.get<Workout>(`SELECT * FROM workout WHERE id = ?`, [id]);
  if (!workout) return null;
  const rows = await db.all<{
    we_id: number; workout_id: number; exercise_id: string; position: number; we_notes: string; rest_seconds: number | null;
    name: string; equipment: string; primary_muscle: string; secondary_muscles: string;
    category: 'strength' | 'cardio'; met: number | null; is_custom: number; is_archived: number;
  }>(
    `SELECT we.id AS we_id, we.workout_id, we.exercise_id, we.position, we.notes AS we_notes, we.rest_seconds,
            e.name, e.equipment, e.primary_muscle, e.secondary_muscles, e.category, e.met, e.is_custom, e.is_archived
     FROM workout_exercise we JOIN exercise e ON e.id = we.exercise_id
     WHERE we.workout_id = ? ORDER BY we.position`,
    [id],
  );
  const exercises = [];
  for (const r of rows) {
    const sets = await db.all<WorkoutSet>(
      `SELECT * FROM workout_set WHERE workout_exercise_id = ? ORDER BY position`, [r.we_id],
    );
    exercises.push({
      id: r.we_id, workout_id: r.workout_id, exercise_id: r.exercise_id,
      position: r.position, notes: r.we_notes, rest_seconds: r.rest_seconds,
      exercise: {
        id: r.exercise_id, name: r.name, equipment: r.equipment, primary_muscle: r.primary_muscle,
        secondary_muscles: r.secondary_muscles, category: r.category, met: r.met,
        is_custom: r.is_custom, is_archived: r.is_archived,
      } as Exercise,
      sets,
    });
  }
  return { workout, exercises };
}

/** Most recent finished session's completed sets for an exercise, by set position. */
export async function previousSets(exerciseId: string): Promise<WorkoutSet[]> {
  return getDb().all<WorkoutSet>(
    `SELECT ws.* FROM workout_set ws
     JOIN workout_exercise we ON we.id = ws.workout_exercise_id
     WHERE we.exercise_id = ?
       AND we.workout_id = (
         SELECT w.id FROM workout w
         JOIN workout_exercise we2 ON we2.workout_id = w.id
         WHERE we2.exercise_id = ? AND w.finished_at IS NOT NULL
         ORDER BY w.started_at DESC, w.id DESC LIMIT 1
       )
       AND ws.is_completed = 1
     ORDER BY ws.position`,
    [exerciseId, exerciseId],
  );
}

export async function findUnfinishedWorkout(): Promise<Workout | null> {
  return getDb().get<Workout>(`SELECT * FROM workout WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1`);
}

/** Create an empty in-progress workout. */
export async function createWorkout(name: string, routineId: number | null): Promise<number> {
  const r = await getDb().run(
    `INSERT INTO workout (routine_id, name, started_at) VALUES (?, ?, ?)`,
    [routineId, name, Date.now()],
  );
  return r.lastInsertRowId;
}

/** Start a workout from a routine template, prefilling from the previous session. */
export async function startFromRoutine(routineId: number): Promise<number | null> {
  const detail = await getRoutineDetail(routineId);
  if (!detail) return null;
  const db = getDb();
  let workoutId = 0;
  await db.transaction(async () => {
    const w = await db.run(
      `INSERT INTO workout (routine_id, name, started_at) VALUES (?, ?, ?)`,
      [routineId, detail.routine.name, Date.now()],
    );
    workoutId = w.lastInsertRowId;
    for (const re of detail.exercises) {
      const prev = await previousSets(re.exercise_id);
      const we = await db.run(
        `INSERT INTO workout_exercise (workout_id, exercise_id, position, notes, rest_seconds)
         VALUES (?, ?, ?, ?, ?)`,
        [workoutId, re.exercise_id, re.position, re.notes, re.rest_seconds],
      );
      const count = Math.max(re.sets.length, 1);
      for (let i = 0; i < count; i++) {
        const p = prev[i];
        const t = re.sets[i];
        await db.run(
          `INSERT INTO workout_set (workout_exercise_id, position, weight_kg, reps, duration_s, is_completed)
           VALUES (?, ?, ?, ?, ?, 0)`,
          [we.lastInsertRowId, i,
            p?.weight_kg ?? t?.target_weight_kg ?? null,
            p?.reps ?? t?.target_reps_max ?? null,
            p?.duration_s ?? t?.target_duration_s ?? null],
        );
      }
    }
  });
  return workoutId;
}

export async function addExerciseToWorkout(workoutId: number, exerciseId: string, defaultRestS: number | null): Promise<number> {
  const db = getDb();
  const pos = await db.get<{ p: number }>(
    `SELECT COALESCE(MAX(position) + 1, 0) AS p FROM workout_exercise WHERE workout_id = ?`, [workoutId],
  );
  const prev = await previousSets(exerciseId);
  let weId = 0;
  await db.transaction(async () => {
    const we = await db.run(
      `INSERT INTO workout_exercise (workout_id, exercise_id, position, rest_seconds) VALUES (?, ?, ?, ?)`,
      [workoutId, exerciseId, pos?.p ?? 0, defaultRestS],
    );
    weId = we.lastInsertRowId;
    const count = Math.max(prev.length, 1);
    for (let i = 0; i < count; i++) {
      const p = prev[i];
      await db.run(
        `INSERT INTO workout_set (workout_exercise_id, position, weight_kg, reps, duration_s, is_completed)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [weId, i, p?.weight_kg ?? null, p?.reps ?? null, p?.duration_s ?? null],
      );
    }
  });
  return weId;
}

export interface WorkoutTotals { volumeKg: number; sets: number }

export async function computeTotals(workoutId: number, db: SqlDriver = getDb()): Promise<WorkoutTotals> {
  const row = await db.get<{ volume: number | null; sets: number }>(
    `SELECT SUM(CASE WHEN e.category = 'strength' THEN COALESCE(ws.weight_kg, 0) * COALESCE(ws.reps, 0) ELSE 0 END) AS volume,
            COUNT(*) AS sets
     FROM workout_set ws
     JOIN workout_exercise we ON we.id = ws.workout_exercise_id
     JOIN exercise e ON e.id = we.exercise_id
     WHERE we.workout_id = ? AND ws.is_completed = 1`,
    [workoutId],
  );
  return { volumeKg: row?.volume ?? 0, sets: row?.sets ?? 0 };
}

async function cardioSetsFor(workoutId: number, db: SqlDriver): Promise<{ met: number; durationS: number }[]> {
  const rows = await db.all<{ met: number | null; duration_s: number | null }>(
    `SELECT e.met, ws.duration_s FROM workout_set ws
     JOIN workout_exercise we ON we.id = ws.workout_exercise_id
     JOIN exercise e ON e.id = we.exercise_id
     WHERE we.workout_id = ? AND ws.is_completed = 1 AND e.category = 'cardio'`,
    [workoutId],
  );
  return rows.filter((r) => r.duration_s).map((r) => ({ met: r.met ?? 5, durationS: r.duration_s! }));
}

export interface FinishOptions {
  name: string;
  notes: string;
  finishedAt: number;
  bodyWeightKg: number | null;
}

export interface FinishResult { prCount: number; caloriesKcal: number; durationS: number }

export async function finishWorkout(workoutId: number, opts: FinishOptions): Promise<FinishResult> {
  const db = getDb();
  let result: FinishResult = { prCount: 0, caloriesKcal: 0, durationS: 0 };
  await db.transaction(async () => {
    // Drop never-touched exercises and their sets; drop empty uncompleted sets.
    await db.run(
      `DELETE FROM workout_set WHERE is_completed = 0 AND workout_exercise_id IN
        (SELECT id FROM workout_exercise WHERE workout_id = ?)`,
      [workoutId],
    );
    await db.run(
      `DELETE FROM workout_exercise WHERE workout_id = ? AND id NOT IN
        (SELECT DISTINCT workout_exercise_id FROM workout_set)`,
      [workoutId],
    );
    const w = await db.get<{ started_at: number }>(`SELECT started_at FROM workout WHERE id = ?`, [workoutId]);
    const durationS = Math.max(0, Math.round((opts.finishedAt - (w?.started_at ?? opts.finishedAt)) / 1000));
    const totals = await computeTotals(workoutId, db);
    const cardio = await cardioSetsFor(workoutId, db);
    const kcal = workoutKcal({ durationS, cardioSets: cardio, bodyWeightKg: opts.bodyWeightKg });
    await db.run(
      `UPDATE workout SET name = ?, notes = ?, finished_at = ?, duration_s = ?, total_volume_kg = ?, total_sets = ?, calories_kcal = ?
       WHERE id = ?`,
      [opts.name, opts.notes, opts.finishedAt, durationS, totals.volumeKg, totals.sets, kcal, workoutId],
    );
    const prCount = await detectPrsForWorkout(workoutId, db);
    await db.run(`UPDATE workout SET pr_count = ? WHERE id = ?`, [prCount, workoutId]);
    result = { prCount, caloriesKcal: kcal, durationS };
  });
  return result;
}

export async function discardWorkout(workoutId: number): Promise<void> {
  // Verify the row actually went: a silent no-op here is what left an orphaned
  // in-progress workout behind after the user tapped Discard.
  const { changes } = await getDb().run(`DELETE FROM workout WHERE id = ?`, [workoutId]);
  if (changes === 0) throw new Error('That workout was no longer in the database.');
}

export async function deleteWorkout(workoutId: number): Promise<void> {
  await getDb().run(`DELETE FROM workout WHERE id = ?`, [workoutId]);
}

/** Recompute denormalised totals after editing a past workout. */
export async function recomputeFinishedWorkout(workoutId: number, bodyWeightKg: number | null): Promise<void> {
  const db = getDb();
  await db.transaction(async () => {
    const w = await db.get<{ duration_s: number | null }>(`SELECT duration_s FROM workout WHERE id = ?`, [workoutId]);
    const totals = await computeTotals(workoutId, db);
    const cardio = await cardioSetsFor(workoutId, db);
    const kcal = workoutKcal({ durationS: w?.duration_s ?? 0, cardioSets: cardio, bodyWeightKg });
    await db.run(
      `UPDATE workout SET total_volume_kg = ?, total_sets = ?, calories_kcal = ? WHERE id = ?`,
      [totals.volumeKg, totals.sets, kcal, workoutId],
    );
  });
}

// ------- set-level mutations used by the active workout store -------

export async function updateSet(setId: number, patch: {
  weightKg?: number | null; reps?: number | null; durationS?: number | null;
  isCompleted?: boolean; completedAt?: number | null;
}): Promise<void> {
  const cols: string[] = [];
  const params: (string | number | null)[] = [];
  if ('weightKg' in patch) { cols.push('weight_kg = ?'); params.push(patch.weightKg ?? null); }
  if ('reps' in patch) { cols.push('reps = ?'); params.push(patch.reps ?? null); }
  if ('durationS' in patch) { cols.push('duration_s = ?'); params.push(patch.durationS ?? null); }
  if ('isCompleted' in patch) {
    cols.push('is_completed = ?'); params.push(patch.isCompleted ? 1 : 0);
    cols.push('completed_at = ?'); params.push(patch.isCompleted ? (patch.completedAt ?? Date.now()) : null);
  }
  if (!cols.length) return;
  params.push(setId);
  await getDb().run(`UPDATE workout_set SET ${cols.join(', ')} WHERE id = ?`, params);
}

export async function addSet(workoutExerciseId: number): Promise<number> {
  const db = getDb();
  const last = await db.get<{ p: number | null; weight_kg: number | null; reps: number | null; duration_s: number | null }>(
    `SELECT position AS p, weight_kg, reps, duration_s FROM workout_set
     WHERE workout_exercise_id = ? ORDER BY position DESC LIMIT 1`,
    [workoutExerciseId],
  );
  const r = await db.run(
    `INSERT INTO workout_set (workout_exercise_id, position, weight_kg, reps, duration_s, is_completed)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [workoutExerciseId, (last?.p ?? -1) + 1, last?.weight_kg ?? null, last?.reps ?? null, last?.duration_s ?? null],
  );
  return r.lastInsertRowId;
}

export async function removeSet(setId: number): Promise<void> {
  await getDb().run(`DELETE FROM workout_set WHERE id = ?`, [setId]);
}

export async function setExerciseRestSeconds(workoutExerciseId: number, restSeconds: number | null): Promise<void> {
  await getDb().run(`UPDATE workout_exercise SET rest_seconds = ? WHERE id = ?`, [restSeconds, workoutExerciseId]);
}

export async function removeWorkoutExercise(workoutExerciseId: number): Promise<void> {
  await getDb().run(`DELETE FROM workout_exercise WHERE id = ?`, [workoutExerciseId]);
}
