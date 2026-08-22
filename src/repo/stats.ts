import { getDb } from '../db/database';
import { DAY_MS, dayKey, startOfDay, startOfWeek } from '../lib/dates';

export interface Totals { workouts: number; volumeKg: number; hours: number; kcal: number }

export async function allTimeTotals(sinceMs = 0): Promise<Totals> {
  const row = await getDb().get<{ n: number; vol: number | null; sec: number | null; kcal: number | null }>(
    `SELECT COUNT(*) AS n, SUM(total_volume_kg) AS vol, SUM(duration_s) AS sec, SUM(calories_kcal) AS kcal
     FROM workout WHERE finished_at IS NOT NULL AND started_at >= ?`,
    [sinceMs],
  );
  return {
    workouts: row?.n ?? 0,
    volumeKg: row?.vol ?? 0,
    hours: Math.round(((row?.sec ?? 0) / 3600) * 10) / 10,
    kcal: Math.round(row?.kcal ?? 0),
  };
}

/** Sessions per week for the trailing n weeks, oldest first. */
export async function sessionsPerWeek(nWeeks: number, now = Date.now()): Promise<{ weekStart: number; count: number }[]> {
  const thisWeek = startOfWeek(now);
  const from = thisWeek - (nWeeks - 1) * 7 * DAY_MS;
  const rows = await getDb().all<{ started_at: number }>(
    `SELECT started_at FROM workout WHERE finished_at IS NOT NULL AND started_at >= ?`, [from],
  );
  const buckets = new Map<number, number>();
  for (let i = 0; i < nWeeks; i++) buckets.set(from + i * 7 * DAY_MS, 0);
  for (const r of rows) {
    const ws = startOfWeek(r.started_at);
    if (buckets.has(ws)) buckets.set(ws, (buckets.get(ws) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([weekStart, count]) => ({ weekStart, count }));
}

/** Consecutive weeks with at least one finished workout, counting back from now. */
export async function weekStreak(now = Date.now()): Promise<number> {
  const rows = await getDb().all<{ started_at: number }>(
    `SELECT started_at FROM workout WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1000`,
  );
  const weeks = new Set(rows.map((r) => startOfWeek(r.started_at)));
  let streak = 0;
  let cursor = startOfWeek(now);
  if (!weeks.has(cursor)) cursor -= 7 * DAY_MS; // current week may still be in progress
  while (weeks.has(cursor)) {
    streak++;
    cursor -= 7 * DAY_MS;
  }
  return streak;
}

/** Days without a workout so far this week (Mon..today). */
export async function restDaysThisWeek(now = Date.now()): Promise<number> {
  const ws = startOfWeek(now);
  const rows = await getDb().all<{ started_at: number }>(
    `SELECT started_at FROM workout WHERE finished_at IS NOT NULL AND started_at >= ?`, [ws],
  );
  const trained = new Set(rows.map((r) => dayKey(r.started_at)));
  const today = startOfDay(now);
  let rest = 0;
  for (let d = ws; d <= today; d += DAY_MS) {
    if (!trained.has(dayKey(d))) rest++;
  }
  return rest;
}

export async function mostTrained(limit = 6, sinceMs = 0): Promise<{ exercise_id: string; name: string; sessions: number }[]> {
  return getDb().all(
    `SELECT we.exercise_id, e.name, COUNT(DISTINCT we.workout_id) AS sessions
     FROM workout_exercise we
     JOIN workout w ON w.id = we.workout_id
     JOIN exercise e ON e.id = we.exercise_id
     WHERE w.finished_at IS NOT NULL AND w.started_at >= ?
     GROUP BY we.exercise_id ORDER BY sessions DESC LIMIT ?`,
    [sinceMs, limit],
  );
}

export async function kcalToday(now = Date.now()): Promise<number> {
  const from = startOfDay(now);
  const row = await getDb().get<{ kcal: number | null }>(
    `SELECT SUM(calories_kcal) AS kcal FROM workout WHERE finished_at IS NOT NULL AND started_at >= ? AND started_at < ?`,
    [from, from + DAY_MS],
  );
  return Math.round(row?.kcal ?? 0);
}

export interface ExercisePoint { t: number; value: number }

/** Best value per finished workout for charting (e1rm/weight for strength, duration for cardio). */
export async function exerciseTrend(
  exerciseId: string, metric: 'e1rm' | 'weight' | 'volume' | 'duration', sinceMs: number,
): Promise<ExercisePoint[]> {
  const expr = metric === 'e1rm'
    ? `MAX(ws.weight_kg * (1 + ws.reps / 30.0))`
    : metric === 'weight'
      ? `MAX(ws.weight_kg)`
      : metric === 'volume'
        ? `SUM(ws.weight_kg * ws.reps)`
        : `SUM(ws.duration_s)`;
  const rows = await getDb().all<{ t: number; value: number | null }>(
    `SELECT w.started_at AS t, ${expr} AS value
     FROM workout_set ws
     JOIN workout_exercise we ON we.id = ws.workout_exercise_id
     JOIN workout w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND w.finished_at IS NOT NULL AND ws.is_completed = 1 AND w.started_at >= ?
     GROUP BY w.id ORDER BY w.started_at ASC`,
    [exerciseId, sinceMs],
  );
  return rows.filter((r) => r.value != null && r.value > 0)
    .map((r) => ({ t: r.t, value: Math.round((r.value as number) * 10) / 10 }));
}

export interface ExerciseSession {
  workout_id: number; workout_name: string; started_at: number; pr: number;
  sets: { weight_kg: number | null; reps: number | null; duration_s: number | null; is_pr: number }[];
}

export async function exerciseSessions(exerciseId: string, limit = 30): Promise<ExerciseSession[]> {
  const db = getDb();
  const workouts = await db.all<{ id: number; name: string; started_at: number }>(
    `SELECT DISTINCT w.id, w.name, w.started_at
     FROM workout w JOIN workout_exercise we ON we.workout_id = w.id
     WHERE we.exercise_id = ? AND w.finished_at IS NOT NULL
     ORDER BY w.started_at DESC LIMIT ?`,
    [exerciseId, limit],
  );
  const out: ExerciseSession[] = [];
  for (const w of workouts) {
    const sets = await db.all<{ weight_kg: number | null; reps: number | null; duration_s: number | null; is_pr: number }>(
      `SELECT ws.weight_kg, ws.reps, ws.duration_s,
              EXISTS(SELECT 1 FROM personal_record pr WHERE pr.workout_set_id = ws.id) AS is_pr
       FROM workout_set ws JOIN workout_exercise we ON we.id = ws.workout_exercise_id
       WHERE we.workout_id = ? AND we.exercise_id = ? AND ws.is_completed = 1
       ORDER BY we.position, ws.position`,
      [w.id, exerciseId],
    );
    out.push({
      workout_id: w.id, workout_name: w.name, started_at: w.started_at,
      pr: sets.some((s) => s.is_pr) ? 1 : 0, sets,
    });
  }
  return out;
}
