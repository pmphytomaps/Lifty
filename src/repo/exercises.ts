import { getDb } from '../db/database';
import type { Exercise } from './types';

export interface ExerciseFilter {
  search?: string;
  equipment?: string | null;
  muscle?: string | null;
}

export async function listExercises(f: ExerciseFilter = {}): Promise<Exercise[]> {
  const where: string[] = ['is_archived = 0'];
  const params: (string | number)[] = [];
  // Trim here, not just at the call site: an Android word-suggestion tap appends
  // a space, and "%Volleyball %" matches nothing while the screen still shows the
  // trimmed text, reading as "Nothing matches" for an exercise that exists.
  const term = f.search?.trim();
  if (term) {
    where.push(`name LIKE ?`);
    params.push(`%${term}%`);
  }
  if (f.equipment) {
    where.push(`equipment = ?`);
    params.push(f.equipment);
  }
  if (f.muscle) {
    where.push(`(primary_muscle = ? OR secondary_muscles LIKE ?)`);
    params.push(f.muscle, `%"${f.muscle}"%`);
  }
  // No LIMIT: a cap of 400 over a 729-entry catalogue silently hid everything
  // alphabetically past "Pallof Press" — Running, Swimming, Tennis, Volleyball.
  // FlatList virtualises the rows, so the full list costs nothing to render.
  return getDb().all<Exercise>(
    `SELECT * FROM exercise WHERE ${where.join(' AND ')} ORDER BY name COLLATE NOCASE`,
    params,
  );
}

/** Total selectable exercises, for the search placeholder. */
export async function countExercises(): Promise<number> {
  const row = await getDb().get<{ n: number }>(`SELECT COUNT(*) AS n FROM exercise WHERE is_archived = 0`);
  return row?.n ?? 0;
}

/**
 * Hide a user-created exercise. Archiving rather than deleting keeps any logged
 * sets and personal records that reference it intact.
 */
export async function archiveCustomExercise(id: string): Promise<void> {
  await getDb().run(`UPDATE exercise SET is_archived = 1 WHERE id = ? AND is_custom = 1`, [id]);
}

export async function getExercise(id: string): Promise<Exercise | null> {
  return getDb().get<Exercise>(`SELECT * FROM exercise WHERE id = ?`, [id]);
}

export async function recentExerciseIds(limit = 10): Promise<string[]> {
  const rows = await getDb().all<{ exercise_id: string }>(
    `SELECT we.exercise_id, MAX(w.started_at) AS last
     FROM workout_exercise we JOIN workout w ON w.id = we.workout_id
     WHERE w.finished_at IS NOT NULL
     GROUP BY we.exercise_id ORDER BY last DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => r.exercise_id);
}

export async function createCustomExercise(input: {
  name: string; equipment: string; primaryMuscle: string; category: 'strength' | 'cardio'; met?: number | null;
}): Promise<string> {
  const id = `u_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  await getDb().run(
    `INSERT INTO exercise (id, name, equipment, primary_muscle, secondary_muscles, category, met, is_custom, created_at)
     VALUES (?, ?, ?, ?, '[]', ?, ?, 1, ?)`,
    [id, input.name.trim(), input.equipment, input.primaryMuscle, input.category, input.met ?? null, Date.now()],
  );
  return id;
}
