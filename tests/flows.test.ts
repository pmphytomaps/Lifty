/**
 * End-to-end exercises of the flows a user actually performs, against a real
 * SQLite database through the same repository calls the screens make.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../src/db/database';
import { exportCsv } from '../src/export/csv';
import { createCustomExercise, listExercises, recentExerciseIds } from '../src/repo/exercises';
import { bestsForExercise, rebuildAllPrs } from '../src/repo/prs';
import {
  createRoutine, deleteRoutine, duplicateRoutine, getRoutineDetail, listRoutines, updateRoutine,
} from '../src/repo/routines';
import { exerciseSessions, exerciseTrend, mostTrained } from '../src/repo/stats';
import {
  addExerciseToWorkout, addSet, createWorkout, deleteWorkout, discardWorkout, finishWorkout,
  findUnfinishedWorkout, getWorkoutDetail, previousSets, recomputeFinishedWorkout, removeSet,
  removeWorkoutExercise, setWorkoutDate, startFromRoutine, updateSet, workoutsBetween,
} from '../src/repo/workouts';
import { fromDisplayWeight, toDisplayWeight, fmtVolume, stepFor } from '../src/lib/units';
import { freshDb } from './helpers';

let db: SqlDriver;
beforeEach(async () => {
  db = await freshDb();
});

const idOf = async (name: string): Promise<string> => {
  const r = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = ?`, [name]);
  if (!r) throw new Error(`missing exercise ${name}`);
  return r.id;
};

describe('routine lifecycle', () => {
  it('creates, edits, duplicates and deletes without touching logged history', async () => {
    const bench = await idOf('Bench Press (Barbell)');
    const squat = await idOf('Squat (Barbell)');

    const id = await createRoutine({
      name: 'Test Day', notes: 'hi', folderId: null,
      exercises: [{
        exerciseId: bench, notes: 'touch and go', restSeconds: 150,
        sets: [{ repsMin: 5, repsMax: 7, weightKg: null, durationS: null },
               { repsMin: 5, repsMax: 7, weightKg: null, durationS: null }],
      }],
    });
    let d = await getRoutineDetail(id);
    expect(d!.routine.name).toBe('Test Day');
    expect(d!.exercises[0].rest_seconds).toBe(150);
    expect(d!.exercises[0].sets).toHaveLength(2);

    // Editing replaces exercises; old rows must not linger.
    await updateRoutine(id, {
      name: 'Test Day B', notes: '', folderId: null,
      exercises: [{
        exerciseId: squat, notes: '', restSeconds: null,
        sets: [{ repsMin: 8, repsMax: 10, weightKg: 60, durationS: null }],
      }],
    });
    d = await getRoutineDetail(id);
    expect(d!.routine.name).toBe('Test Day B');
    expect(d!.exercises).toHaveLength(1);
    expect(d!.exercises[0].exercise.name).toBe('Squat (Barbell)');
    const orphans = await db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM routine_set WHERE routine_exercise_id NOT IN (SELECT id FROM routine_exercise)`);
    expect(orphans!.n).toBe(0);

    const copyId = await duplicateRoutine(id);
    const copy = await getRoutineDetail(copyId!);
    expect(copy!.routine.name).toBe('Test Day B (copy)');
    expect(copy!.exercises[0].sets[0].target_weight_kg).toBe(60);

    // A logged workout from this routine survives the routine being deleted.
    const wId = await startFromRoutine(id);
    const setRow = await db.get<{ id: number }>(`SELECT id FROM workout_set LIMIT 1`);
    await updateSet(setRow!.id, { weightKg: 60, reps: 8, isCompleted: true });
    await finishWorkout(wId!, { name: 'Test Day B', notes: '', finishedAt: Date.now(), bodyWeightKg: 70 });
    await deleteRoutine(id);
    expect((await listRoutines()).find((r) => r.id === id)).toBeUndefined();
    const survivor = await db.get<{ n: number; routine_id: number | null }>(
      `SELECT COUNT(*) AS n, routine_id FROM workout WHERE id = ?`, [wId!]);
    expect(survivor!.n).toBe(1);
    expect(survivor!.routine_id).toBeNull(); // FK set null, workout kept
  });

  it('routine summary reports exercise count and last-done', async () => {
    const routines = await listRoutines();
    const pushA = routines.find((r) => r.name === 'Push A')!;
    expect(pushA.exercise_count).toBe(5);
    expect(pushA.exercise_names).toContain('Bench Press (Barbell)');
    expect(pushA.last_done_at).toBeNull();

    const wId = await startFromRoutine(pushA.id);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set LIMIT 1`);
    await updateSet(s!.id, { weightKg: 60, reps: 5, isCompleted: true });
    await finishWorkout(wId!, { name: 'Push A', notes: '', finishedAt: Date.now(), bodyWeightKg: 70 });
    const after = (await listRoutines()).find((r) => r.name === 'Push A')!;
    expect(after.last_done_at).not.toBeNull();
  });
});

describe('custom exercises', () => {
  it('is searchable, usable in a workout, and rejects duplicate names', async () => {
    const id = await createCustomExercise({
      name: 'Cable Y-Raise', equipment: 'cable', primaryMuscle: 'Shoulders', category: 'strength',
    });
    const found = await listExercises({ search: 'Y-Raise' });
    expect(found.map((e) => e.id)).toContain(id);
    expect(found[0].is_custom).toBe(1);

    const wId = await createWorkout('Test', null);
    const weId = await addExerciseToWorkout(wId, id, 120);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await updateSet(s!.id, { weightKg: 12.5, reps: 12, isCompleted: true });
    await finishWorkout(wId, { name: 'Test', notes: '', finishedAt: Date.now(), bodyWeightKg: 70 });
    expect((await bestsForExercise(id)).weight!.value).toBe(12.5);

    await expect(createCustomExercise({
      name: 'Cable Y-Raise', equipment: 'cable', primaryMuscle: 'Shoulders', category: 'strength',
    })).rejects.toThrow();
  });

  it('a custom cardio exercise burns calories from its own MET', async () => {
    const id = await createCustomExercise({
      name: 'Squash', equipment: 'other', primaryMuscle: 'Cardio', category: 'cardio', met: 7.3,
    });
    const wId = await createWorkout('Squash night', null);
    const t = Date.parse('2026-09-01T18:00:00Z');
    await db.run(`UPDATE workout SET started_at = ? WHERE id = ?`, [t, wId]);
    const weId = await addExerciseToWorkout(wId, id, null);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await updateSet(s!.id, { durationS: 2700, isCompleted: true });
    const res = await finishWorkout(wId, { name: 'Squash night', notes: '', finishedAt: t + 2700_000, bodyWeightKg: 70.8 });
    expect(res.caloriesKcal).toBe(Math.round(7.3 * 70.8 * 0.75));
  });
});

describe('mid-workout editing', () => {
  it('adds and removes sets and exercises, and totals follow', async () => {
    const bench = await idOf('Bench Press (Barbell)');
    const wId = await createWorkout('Session', null);
    const weId = await addExerciseToWorkout(wId, bench, 120);

    const first = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    const second = await addSet(weId);
    const third = await addSet(weId);
    for (const id of [first!.id, second, third]) {
      await updateSet(id, { weightKg: 60, reps: 10, isCompleted: true });
    }
    let detail = await getWorkoutDetail(wId);
    expect(detail!.exercises[0].sets).toHaveLength(3);
    expect(detail!.exercises[0].sets.map((s) => s.position)).toEqual([0, 1, 2]);

    await removeSet(third);
    detail = await getWorkoutDetail(wId);
    expect(detail!.exercises[0].sets).toHaveLength(2);

    const squatWe = await addExerciseToWorkout(wId, await idOf('Squat (Barbell)'), 120);
    await removeWorkoutExercise(squatWe);
    detail = await getWorkoutDetail(wId);
    expect(detail!.exercises).toHaveLength(1);
    const orphanSets = await db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM workout_set WHERE workout_exercise_id NOT IN (SELECT id FROM workout_exercise)`);
    expect(orphanSets!.n).toBe(0);

    const res = await finishWorkout(wId, { name: 'Session', notes: '', finishedAt: Date.now(), bodyWeightKg: 70 });
    expect(res.prCount).toBeGreaterThan(0);
    const w = await db.get<{ total_sets: number; total_volume_kg: number }>(
      `SELECT total_sets, total_volume_kg FROM workout WHERE id = ?`, [wId]);
    expect(w!.total_sets).toBe(2);
    expect(w!.total_volume_kg).toBe(1200);
  });

  it('finishing drops untouched sets but keeps every completed one', async () => {
    const bench = await idOf('Bench Press (Barbell)');
    const wId = await createWorkout('Session', null);
    const weId = await addExerciseToWorkout(wId, bench, 120);
    const s1 = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await addSet(weId);
    await addSet(weId);
    await updateSet(s1!.id, { weightKg: 60, reps: 8, isCompleted: true });
    await finishWorkout(wId, { name: 'Session', notes: '', finishedAt: Date.now(), bodyWeightKg: 70 });
    const detail = await getWorkoutDetail(wId);
    expect(detail!.exercises[0].sets).toHaveLength(1);
  });

  it('an exercise with nothing logged disappears on finish', async () => {
    const wId = await createWorkout('Session', null);
    const weId = await addExerciseToWorkout(wId, await idOf('Bench Press (Barbell)'), 120);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await updateSet(s!.id, { weightKg: 60, reps: 8, isCompleted: true });
    await addExerciseToWorkout(wId, await idOf('Squat (Barbell)'), 120); // never touched
    await finishWorkout(wId, { name: 'Session', notes: '', finishedAt: Date.now(), bodyWeightKg: 70 });
    const detail = await getWorkoutDetail(wId);
    expect(detail!.exercises).toHaveLength(1);
    expect(detail!.exercises[0].exercise.name).toBe('Bench Press (Barbell)');
  });

  it('discarding leaves nothing behind', async () => {
    const wId = await createWorkout('Session', null);
    await addExerciseToWorkout(wId, await idOf('Bench Press (Barbell)'), 120);
    await discardWorkout(wId);
    expect(await findUnfinishedWorkout()).toBeNull();
    const leftovers = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM workout_exercise`);
    expect(leftovers!.n).toBe(0);
  });
});

describe('editing a past workout', () => {
  it('recomputes totals and rewrites records', async () => {
    const bench = await idOf('Bench Press (Barbell)');
    const wId = await createWorkout('Session', null);
    const weId = await addExerciseToWorkout(wId, bench, 120);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await updateSet(s!.id, { weightKg: 100, reps: 5, isCompleted: true });
    await finishWorkout(wId, { name: 'Session', notes: '', finishedAt: Date.now(), bodyWeightKg: 70 });
    expect((await bestsForExercise(bench)).weight!.value).toBe(100);

    // Correct a typo: it was really 60 kg.
    await updateSet(s!.id, { weightKg: 60 });
    await recomputeFinishedWorkout(wId, 70);
    await rebuildAllPrs(db);
    const w = await db.get<{ total_volume_kg: number }>(`SELECT total_volume_kg FROM workout WHERE id = ?`, [wId]);
    expect(w!.total_volume_kg).toBe(300);
    expect((await bestsForExercise(bench)).weight!.value).toBe(60);
  });

  it('deleting a workout removes the records it set', async () => {
    const bench = await idOf('Bench Press (Barbell)');
    const wId = await createWorkout('Session', null);
    const weId = await addExerciseToWorkout(wId, bench, 120);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await updateSet(s!.id, { weightKg: 90, reps: 3, isCompleted: true });
    await finishWorkout(wId, { name: 'Session', notes: '', finishedAt: Date.now(), bodyWeightKg: 70 });
    await deleteWorkout(wId);
    await rebuildAllPrs(db);
    expect(Object.keys(await bestsForExercise(bench))).toHaveLength(0);
    const dangling = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM personal_record`);
    expect(dangling!.n).toBe(0);
  });

  it('re-finishing does not double-count its own records', async () => {
    const bench = await idOf('Bench Press (Barbell)');
    const wId = await createWorkout('Session', null);
    const weId = await addExerciseToWorkout(wId, bench, 120);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await updateSet(s!.id, { weightKg: 80, reps: 5, isCompleted: true });
    const first = await finishWorkout(wId, { name: 'S', notes: '', finishedAt: Date.now(), bodyWeightKg: 70 });
    const second = await finishWorkout(wId, { name: 'S', notes: '', finishedAt: Date.now(), bodyWeightKg: 70 });
    expect(second.prCount).toBe(first.prCount);
    const rows = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM personal_record WHERE workout_id = ?`, [wId]);
    expect(rows!.n).toBe(first.prCount);
  });
});

describe('units', () => {
  it('kg values survive a round trip through pounds', () => {
    for (const kg of [2.5, 17.5, 60, 102.5, 137.5]) {
      const shown = toDisplayWeight(kg, 'lb');
      expect(fromDisplayWeight(shown, 'lb')).toBeCloseTo(kg, 1);
    }
  });

  it('volume formatting groups thousands and keeps one decimal', () => {
    expect(fmtVolume(2687.5, 'kg')).toBe('2 687,5');
    expect(fmtVolume(1000, 'kg')).toBe('1 000');
  });

  it('weight steps match the equipment and unit', () => {
    expect(stepFor('barbell', 'kg')).toBe(2.5);
    expect(stepFor('dumbbell', 'kg')).toBe(1);
    expect(stepFor('barbell', 'lb')).toBe(5);
  });
});

describe('history and stats surfaces', () => {
  it('calendar month query respects boundaries', async () => {
    const bench = await idOf('Bench Press (Barbell)');
    const log = async (iso: string) => {
      const wId = await createWorkout('S', null);
      await db.run(`UPDATE workout SET started_at = ? WHERE id = ?`, [Date.parse(iso), wId]);
      const weId = await addExerciseToWorkout(wId, bench, null);
      const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
      await updateSet(s!.id, { weightKg: 60, reps: 5, isCompleted: true });
      await db.run(`UPDATE workout SET finished_at = ? WHERE id = ?`, [Date.parse(iso) + 3600_000, wId]);
    };
    await log('2026-07-31T23:00:00');
    await log('2026-08-01T00:30:00');
    await log('2026-08-31T23:30:00');
    await log('2026-09-01T00:30:00');
    const aug = await workoutsBetween(new Date(2026, 7, 1).getTime(), new Date(2026, 8, 1).getTime());
    expect(aug).toHaveLength(2);
  });

  it('recents, most-trained and per-exercise history reflect real sessions', async () => {
    const bench = await idOf('Bench Press (Barbell)');
    const squat = await idOf('Squat (Barbell)');
    for (const [ex, n] of [[bench, 3], [squat, 1]] as const) {
      for (let i = 0; i < n; i++) {
        const wId = await createWorkout('S', null);
        await db.run(`UPDATE workout SET started_at = ? WHERE id = ?`, [Date.parse('2026-06-01') + i * 86400_000, wId]);
        const weId = await addExerciseToWorkout(wId, ex, null);
        const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
        await updateSet(s!.id, { weightKg: 60 + i * 5, reps: 5, isCompleted: true });
        await finishWorkout(wId, { name: 'S', notes: '', finishedAt: Date.now(), bodyWeightKg: 70 });
      }
    }
    const top = await mostTrained(5);
    expect(top[0].exercise_id).toBe(bench);
    expect(top[0].sessions).toBe(3);
    expect(await recentExerciseIds(5)).toContain(squat);

    const sessions = await exerciseSessions(bench);
    expect(sessions).toHaveLength(3);
    expect(sessions[0].started_at).toBeGreaterThan(sessions[1].started_at); // newest first
    expect(sessions.some((s) => s.sets.some((x) => x.is_pr === 1))).toBe(true);

    const trend = await exerciseTrend(bench, 'e1rm', 0);
    expect(trend).toHaveLength(3);
    expect(trend[2].value).toBeGreaterThan(trend[0].value);
  });

  it('exports cardio minutes alongside strength sets', async () => {
    const bad = await idOf('Badminton');
    const bench = await idOf('Bench Press (Barbell)');
    const t = Date.parse('2026-10-01T10:00:00Z');
    const wId = await createWorkout('Mixed', null);
    await db.run(`UPDATE workout SET started_at = ? WHERE id = ?`, [t, wId]);
    const w1 = await addExerciseToWorkout(wId, bench, null);
    const s1 = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [w1]);
    await updateSet(s1!.id, { weightKg: 60, reps: 8, isCompleted: true });
    const w2 = await addExerciseToWorkout(wId, bad, null);
    const s2 = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [w2]);
    await updateSet(s2!.id, { durationS: 1800, isCompleted: true });
    await finishWorkout(wId, { name: 'Mixed', notes: '', finishedAt: t + 3600_000, bodyWeightKg: 70 });

    const csv = await exportCsv(t - 1000, t + 1000);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Bench Press (Barbell)');
    expect(lines[2]).toContain('Badminton');
    expect(lines[2]).toContain('1800'); // duration column carries the cardio set
  });
});

describe('resume after a crash', () => {
  it('an interrupted session keeps every logged set and its previous column', async () => {
    const bench = await idOf('Bench Press (Barbell)');
    // A completed session two days ago provides the previous values.
    const past = await createWorkout('Old', null);
    await db.run(`UPDATE workout SET started_at = ? WHERE id = ?`, [Date.now() - 2 * 86400_000, past]);
    const pastWe = await addExerciseToWorkout(past, bench, null);
    const ps = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [pastWe]);
    await updateSet(ps!.id, { weightKg: 72.5, reps: 6, isCompleted: true });
    await finishWorkout(past, { name: 'Old', notes: '', finishedAt: Date.now() - 2 * 86400_000 + 3600_000, bodyWeightKg: 70 });

    // Start a new one and log a set, then "crash" (no finish call).
    const routines = await listRoutines();
    const wId = await startFromRoutine(routines[0].id);
    const detail = await getWorkoutDetail(wId!);
    const target = detail!.exercises[0].sets[0];
    expect(target.weight_kg).toBe(72.5); // prefilled from last session
    await updateSet(target.id, { weightKg: 75, reps: 6, isCompleted: true });

    const draft = await findUnfinishedWorkout();
    expect(draft!.id).toBe(wId);
    const resumed = await getWorkoutDetail(draft!.id);
    const kept = resumed!.exercises[0].sets[0];
    expect(kept.weight_kg).toBe(75);
    expect(kept.is_completed).toBe(1);
    expect(await previousSets(bench)).toHaveLength(1); // draft excluded from "previous"
    expect((await previousSets(bench))[0].weight_kg).toBe(72.5);
  });
});

describe('cascade integrity (guards the PRAGMA foreign_keys requirement)', () => {
  it('editing a routine inside a transaction cascades to its sets', async () => {
    const bench = await idOf('Bench Press (Barbell)');
    const id = await createRoutine({
      name: 'Cascade', notes: '', folderId: null,
      exercises: [{
        exerciseId: bench, notes: '', restSeconds: null,
        sets: [
          { repsMin: 5, repsMax: 5, weightKg: null, durationS: null },
          { repsMin: 5, repsMax: 5, weightKg: null, durationS: null },
          { repsMin: 5, repsMax: 5, weightKg: null, durationS: null },
        ],
      }],
    });
    const countSets = async () => (await db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM routine_set WHERE routine_exercise_id IN
         (SELECT id FROM routine_exercise WHERE routine_id = ?)`, [id]))!.n;
    expect(await countSets()).toBe(3);

    await updateRoutine(id, {
      name: 'Cascade', notes: '', folderId: null,
      exercises: [{
        exerciseId: bench, notes: '', restSeconds: null,
        sets: [{ repsMin: 8, repsMax: 8, weightKg: null, durationS: null }],
      }],
    });
    expect(await countSets()).toBe(1); // old rows cascaded away, not orphaned

    // And nothing was left dangling anywhere in the table.
    const orphans = await db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM routine_set WHERE routine_exercise_id NOT IN (SELECT id FROM routine_exercise)`);
    expect(orphans!.n).toBe(0);
  });

  it('deleting a workout cascades to its exercises and sets', async () => {
    const wId = await createWorkout('S', null);
    const weId = await addExerciseToWorkout(wId, await idOf('Squat (Barbell)'), null);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await updateSet(s!.id, { weightKg: 60, reps: 5, isCompleted: true });
    await finishWorkout(wId, { name: 'S', notes: '', finishedAt: Date.now(), bodyWeightKg: 70 });
    await deleteWorkout(wId);
    for (const t of ['workout_exercise', 'workout_set', 'personal_record'] as const) {
      const n = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`);
      expect(`${t}=${n!.n}`).toBe(`${t}=0`);
    }
  });
});

describe('exercise catalogue is fully reachable', () => {
  it('browsing without a search returns every exercise, including late letters', async () => {
    const all = await listExercises({});
    expect(all.length).toBeGreaterThan(700);
    const names = all.map((e) => e.name);
    for (const late of ['Volleyball', 'Running', 'Swimming', 'Tennis', 'Walking (Brisk)']) {
      expect(names).toContain(late);
    }
  });

  it('search finds late-alphabet cardio', async () => {
    expect((await listExercises({ search: 'Volleyball' })).map((e) => e.name)).toContain('Volleyball');
    expect((await listExercises({ search: 'badminton' })).map((e) => e.name)).toContain('Badminton');
  });

  it('the placeholder count matches what browsing returns', async () => {
    const { countExercises } = await import('../src/repo/exercises');
    expect(await countExercises()).toBe((await listExercises({})).length);
  });

  it('archiving a custom exercise hides it but keeps logged history', async () => {
    const { archiveCustomExercise } = await import('../src/repo/exercises');
    const id = await createCustomExercise({
      name: 'Sit', equipment: 'other', primaryMuscle: 'Core', category: 'strength',
    });
    const wId = await createWorkout('S', null);
    const weId = await addExerciseToWorkout(wId, id, null);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await updateSet(s!.id, { weightKg: 0, reps: 20, isCompleted: true });
    await finishWorkout(wId, { name: 'S', notes: '', finishedAt: Date.now(), bodyWeightKg: 70 });

    await archiveCustomExercise(id);
    expect((await listExercises({ search: 'Sit' })).map((e) => e.id)).not.toContain(id);
    const detail = await getWorkoutDetail(wId);
    expect(detail!.exercises[0].exercise.name).toBe('Sit'); // history intact
  });
});

describe('search tolerates what a keyboard actually sends', () => {
  it('finds an exercise despite trailing or leading whitespace', async () => {
    // Android appends a space when a word suggestion is accepted.
    for (const term of ['Volleyball ', ' Volleyball', 'Volleyball  ', '  Badminton  ']) {
      const rows = await listExercises({ search: term });
      expect(`${JSON.stringify(term)} -> ${rows.length > 0}`).toBe(`${JSON.stringify(term)} -> true`);
    }
  });

  it('a whitespace-only search is treated as no search', async () => {
    const blank = await listExercises({ search: '   ' });
    expect(blank.length).toBe((await listExercises({})).length);
  });
});

describe('logging a workout you already did', () => {
  it('a backdated session lands on the chosen day with an explicit duration', async () => {
    const when = Date.parse('2026-08-18T19:30:00');
    const routines = await listRoutines();
    const wId = await startFromRoutine(routines[0].id, when);
    const detail = await getWorkoutDetail(wId!);
    expect(detail!.workout.started_at).toBe(when);

    const first = detail!.exercises[0].sets[0];
    await updateSet(first.id, { weightKg: 70, reps: 6, isCompleted: true });
    const res = await finishWorkout(wId!, {
      name: 'Push A', notes: 'logged later', finishedAt: when + 45 * 60000,
      bodyWeightKg: 70, durationS: 45 * 60, startedAt: when,
    });
    expect(res.durationS).toBe(2700);

    const saved = await db.get<{ started_at: number; duration_s: number; finished_at: number }>(
      `SELECT started_at, duration_s, finished_at FROM workout WHERE id = ?`, [wId!]);
    expect(saved!.started_at).toBe(when);
    expect(saved!.duration_s).toBe(2700);
    expect(saved!.finished_at).toBe(when + 2700_000);

    // It must appear in that week's history, not today's.
    const inThatWeek = await workoutsBetween(Date.parse('2026-08-17'), Date.parse('2026-08-24'));
    expect(inThatWeek.map((w) => w.id)).toContain(wId);
  });

  it('a backdated session does not steal a newer record', async () => {
    const bench = (await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Bench Press (Barbell)'`))!.id;
    const log = async (at: number, kg: number) => {
      const wId = await createWorkout('S', null, at);
      const weId = await addExerciseToWorkout(wId, bench, null);
      const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
      await updateSet(s!.id, { weightKg: kg, reps: 5, isCompleted: true });
      await finishWorkout(wId, { name: 'S', notes: '', finishedAt: at + 3600_000, bodyWeightKg: 70, durationS: 3600, startedAt: at });
      return wId;
    };
    await log(Date.parse('2026-08-20T10:00:00'), 100);
    await log(Date.parse('2026-08-10T10:00:00'), 80); // logged later, happened earlier
    await rebuildAllPrs(db);
    const bests = await bestsForExercise(bench);
    expect(bests.weight!.value).toBe(100);
    expect(bests.weight!.achieved_at).toBe(Date.parse('2026-08-20T10:00:00'));
  });

  it('moving a saved workout re-dates its sets and records', async () => {
    const bench = (await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Bench Press (Barbell)'`))!.id;
    const wrong = Date.parse('2026-08-24T10:00:00');
    const right = Date.parse('2026-08-21T18:00:00');
    const wId = await createWorkout('Legs B', null, wrong);
    const weId = await addExerciseToWorkout(wId, bench, null);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await updateSet(s!.id, { weightKg: 90, reps: 4, isCompleted: true });
    await finishWorkout(wId, { name: 'Legs B', notes: '', finishedAt: wrong + 3600_000, bodyWeightKg: 70 });

    await setWorkoutDate(wId, right, 3180);
    const saved = await db.get<{ started_at: number; duration_s: number }>(
      `SELECT started_at, duration_s FROM workout WHERE id = ?`, [wId]);
    expect(saved!.started_at).toBe(right);
    expect(saved!.duration_s).toBe(3180);

    const pr = await db.get<{ achieved_at: number }>(`SELECT achieved_at FROM personal_record WHERE workout_id = ?`, [wId]);
    expect(pr!.achieved_at).toBe(right);
    const set = await db.get<{ completed_at: number }>(`SELECT completed_at FROM workout_set WHERE id = ?`, [s!.id]);
    expect(set!.completed_at).toBe(right);
  });

  it('an ordinary workout still derives its duration from the clock', async () => {
    const bench = (await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Bench Press (Barbell)'`))!.id;
    const start = Date.now() - 40 * 60000;
    const wId = await createWorkout('Push A', null, start);
    const weId = await addExerciseToWorkout(wId, bench, null);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await updateSet(s!.id, { weightKg: 60, reps: 8, isCompleted: true });
    const res = await finishWorkout(wId, {
      name: 'Push A', notes: '', finishedAt: start + 40 * 60000, bodyWeightKg: 70,
    });
    expect(res.durationS).toBe(2400);
  });
});
