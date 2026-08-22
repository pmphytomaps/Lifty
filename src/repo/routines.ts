import { getDb } from '../db/database';
import type { Exercise, Routine, RoutineExercise, RoutineFolder, RoutineSet } from './types';

export interface RoutineSummary extends Routine {
  folder_name: string | null;
  exercise_names: string;   // comma separated, ordered
  exercise_count: number;
  last_done_at: number | null;
}

export async function listRoutines(): Promise<RoutineSummary[]> {
  return getDb().all<RoutineSummary>(
    `SELECT r.*, f.name AS folder_name,
       (SELECT COUNT(*) FROM routine_exercise re WHERE re.routine_id = r.id) AS exercise_count,
       COALESCE((SELECT GROUP_CONCAT(e.name, ', ')
         FROM routine_exercise re JOIN exercise e ON e.id = re.exercise_id
         WHERE re.routine_id = r.id ORDER BY re.position), '') AS exercise_names,
       (SELECT MAX(w.started_at) FROM workout w WHERE w.routine_id = r.id AND w.finished_at IS NOT NULL) AS last_done_at
     FROM routine r LEFT JOIN routine_folder f ON f.id = r.folder_id
     WHERE r.archived_at IS NULL
     ORDER BY COALESCE(f.position, 999999), r.position, r.created_at`,
  );
}

export async function listFolders(): Promise<RoutineFolder[]> {
  return getDb().all<RoutineFolder>(`SELECT * FROM routine_folder ORDER BY position`);
}

export interface RoutineDetail {
  routine: Routine;
  exercises: (RoutineExercise & { exercise: Exercise; sets: RoutineSet[] })[];
}

export async function getRoutineDetail(id: number): Promise<RoutineDetail | null> {
  const db = getDb();
  const routine = await db.get<Routine>(`SELECT * FROM routine WHERE id = ?`, [id]);
  if (!routine) return null;
  const res = await db.all<RoutineExercise & Exercise & { re_id: number; re_notes: string }>(
    `SELECT re.id AS re_id, re.routine_id, re.exercise_id, re.position, re.notes AS re_notes, re.rest_seconds,
            e.id, e.name, e.equipment, e.primary_muscle, e.secondary_muscles, e.category, e.met, e.is_custom, e.is_archived
     FROM routine_exercise re JOIN exercise e ON e.id = re.exercise_id
     WHERE re.routine_id = ? ORDER BY re.position`,
    [id],
  );
  const exercises = [];
  for (const r of res) {
    const sets = await db.all<RoutineSet>(
      `SELECT * FROM routine_set WHERE routine_exercise_id = ? ORDER BY position`, [r.re_id],
    );
    exercises.push({
      id: r.re_id, routine_id: r.routine_id, exercise_id: r.exercise_id,
      position: r.position, notes: r.re_notes, rest_seconds: r.rest_seconds,
      exercise: {
        id: r.exercise_id, name: r.name, equipment: r.equipment, primary_muscle: r.primary_muscle,
        secondary_muscles: r.secondary_muscles, category: r.category, met: r.met,
        is_custom: r.is_custom, is_archived: r.is_archived,
      } as Exercise,
      sets,
    });
  }
  return { routine, exercises };
}

export interface RoutineDraftExercise {
  exerciseId: string;
  notes: string;
  restSeconds: number | null;
  sets: { repsMin: number | null; repsMax: number | null; weightKg: number | null; durationS: number | null }[];
}

export interface RoutineDraft {
  name: string;
  notes: string;
  folderId: number | null;
  exercises: RoutineDraftExercise[];
}

export async function createRoutine(d: RoutineDraft): Promise<number> {
  const db = getDb();
  let routineId = 0;
  await db.transaction(async () => {
    const pos = await db.get<{ p: number }>(`SELECT COALESCE(MAX(position) + 1, 0) AS p FROM routine`);
    const r = await db.run(
      `INSERT INTO routine (folder_id, name, notes, position, created_at) VALUES (?, ?, ?, ?, ?)`,
      [d.folderId, d.name, d.notes, pos?.p ?? 0, Date.now()],
    );
    routineId = r.lastInsertRowId;
    await insertRoutineExercises(routineId, d.exercises);
  });
  return routineId;
}

export async function updateRoutine(id: number, d: RoutineDraft): Promise<void> {
  const db = getDb();
  await db.transaction(async () => {
    await db.run(`UPDATE routine SET name = ?, notes = ?, folder_id = ? WHERE id = ?`, [d.name, d.notes, d.folderId, id]);
    await db.run(`DELETE FROM routine_exercise WHERE routine_id = ?`, [id]);
    await insertRoutineExercises(id, d.exercises);
  });
}

async function insertRoutineExercises(routineId: number, exercises: RoutineDraftExercise[]): Promise<void> {
  const db = getDb();
  let pos = 0;
  for (const e of exercises) {
    const re = await db.run(
      `INSERT INTO routine_exercise (routine_id, exercise_id, position, notes, rest_seconds) VALUES (?, ?, ?, ?, ?)`,
      [routineId, e.exerciseId, pos++, e.notes, e.restSeconds],
    );
    let sPos = 0;
    for (const s of e.sets) {
      await db.run(
        `INSERT INTO routine_set (routine_exercise_id, position, target_reps_min, target_reps_max, target_weight_kg, target_duration_s)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [re.lastInsertRowId, sPos++, s.repsMin, s.repsMax, s.weightKg, s.durationS],
      );
    }
  }
}

export async function deleteRoutine(id: number): Promise<void> {
  await getDb().run(`DELETE FROM routine WHERE id = ?`, [id]);
}

export async function duplicateRoutine(id: number): Promise<number | null> {
  const detail = await getRoutineDetail(id);
  if (!detail) return null;
  return createRoutine({
    name: `${detail.routine.name} (copy)`,
    notes: detail.routine.notes,
    folderId: detail.routine.folder_id,
    exercises: detail.exercises.map((e) => ({
      exerciseId: e.exercise_id,
      notes: e.notes,
      restSeconds: e.rest_seconds,
      sets: e.sets.map((s) => ({
        repsMin: s.target_reps_min, repsMax: s.target_reps_max,
        weightKg: s.target_weight_kg, durationS: s.target_duration_s,
      })),
    })),
  });
}
