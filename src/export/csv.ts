import { getDb } from '../db/database';

function esc(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function iso(t: number | null): string {
  return t == null ? '' : new Date(t).toISOString();
}

export const CSV_HEADER = [
  'title', 'start_time', 'end_time', 'duration_s', 'exercise', 'muscle',
  'set_index', 'weight_kg', 'reps', 'duration_set_s', 'volume_kg', 'is_pr', 'workout_notes', 'calories_kcal',
].join(',');

/** One row per completed set, workouts ordered oldest first. Range is [from, to). */
export async function exportCsv(fromMs: number, toMs: number): Promise<string> {
  const rows = await getDb().all<{
    title: string; started_at: number; finished_at: number | null; duration_s: number | null;
    notes: string; calories_kcal: number;
    exercise: string; muscle: string; position: number;
    weight_kg: number | null; reps: number | null; set_duration_s: number | null; is_pr: number;
  }>(
    `SELECT w.name AS title, w.started_at, w.finished_at, w.duration_s, w.notes, w.calories_kcal,
            e.name AS exercise, e.primary_muscle AS muscle, ws.position,
            ws.weight_kg, ws.reps, ws.duration_s AS set_duration_s,
            EXISTS(SELECT 1 FROM personal_record pr WHERE pr.workout_set_id = ws.id) AS is_pr
     FROM workout w
     JOIN workout_exercise we ON we.workout_id = w.id
     JOIN exercise e ON e.id = we.exercise_id
     JOIN workout_set ws ON ws.workout_exercise_id = we.id
     WHERE w.finished_at IS NOT NULL AND ws.is_completed = 1 AND w.started_at >= ? AND w.started_at < ?
     ORDER BY w.started_at ASC, we.position ASC, ws.position ASC`,
    [fromMs, toMs],
  );
  const lines = [CSV_HEADER];
  for (const r of rows) {
    const volume = r.weight_kg != null && r.reps != null ? Math.round(r.weight_kg * r.reps * 10) / 10 : '';
    lines.push([
      esc(r.title), iso(r.started_at), iso(r.finished_at), r.duration_s ?? '',
      esc(r.exercise), esc(r.muscle), r.position + 1,
      r.weight_kg ?? '', r.reps ?? '', r.set_duration_s ?? '', volume, r.is_pr ? 1 : 0,
      esc(r.notes), Math.round(r.calories_kcal),
    ].join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

export async function countInRange(fromMs: number, toMs: number): Promise<{ workouts: number; sets: number }> {
  const row = await getDb().get<{ workouts: number; sets: number }>(
    `SELECT COUNT(DISTINCT w.id) AS workouts, COUNT(ws.id) AS sets
     FROM workout w
     LEFT JOIN workout_exercise we ON we.workout_id = w.id
     LEFT JOIN workout_set ws ON ws.workout_exercise_id = we.id AND ws.is_completed = 1
     WHERE w.finished_at IS NOT NULL AND w.started_at >= ? AND w.started_at < ?`,
    [fromMs, toMs],
  );
  return { workouts: row?.workouts ?? 0, sets: row?.sets ?? 0 };
}
