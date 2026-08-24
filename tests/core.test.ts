import { beforeEach, describe, expect, it } from 'vitest';
import { dailyBudget, epley1Rm, mifflinBmr, workoutKcal } from '../src/lib/calories';
import { exportCsv } from '../src/export/csv';
import { createBackup, restoreBackup, validateBackup } from '../src/export/backup';
import { getWorkoutDetail, finishWorkout, previousSets, startFromRoutine, updateSet, findUnfinishedWorkout, createWorkout, addExerciseToWorkout, deleteWorkout } from '../src/repo/workouts';
import { bestsForExercise, detectPrsForWorkout, rebuildAllPrs } from '../src/repo/prs';
import { listRoutines, getRoutineDetail } from '../src/repo/routines';
import { weekStreak, sessionsPerWeek, kcalToday, exerciseTrend } from '../src/repo/stats';
import { listExercises } from '../src/repo/exercises';
import type { SqlDriver } from '../src/db/database';
import { freshDb } from './helpers';

let db: SqlDriver;
beforeEach(async () => {
  db = await freshDb();
});

async function logSession(exName: string, sets: [number, number][], when: number): Promise<number> {
  const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = ?`, [exName]);
  expect(ex).toBeTruthy();
  const wId = await createWorkout('Session', null);
  await db.run(`UPDATE workout SET started_at = ? WHERE id = ?`, [when, wId]);
  const weId = await addExerciseToWorkout(wId, ex!.id, 120);
  const setRows = await db.all<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ? ORDER BY position`, [weId]);
  for (let i = 0; i < sets.length; i++) {
    let setId = setRows[i]?.id;
    if (!setId) {
      const r = await db.run(`INSERT INTO workout_set (workout_exercise_id, position, is_completed) VALUES (?, ?, 0)`, [weId, i]);
      setId = r.lastInsertRowId;
    }
    await updateSet(setId, { weightKg: sets[i][0], reps: sets[i][1], isCompleted: true, completedAt: when });
  }
  await finishWorkout(wId, { name: 'Session', notes: '', finishedAt: when + 3600_000, bodyWeightKg: 70 });
  return wId;
}

describe('seed', () => {
  it('seeds catalog and six PPL routines', async () => {
    const routines = await listRoutines();
    expect(routines.map((r) => r.name)).toEqual(['Push A', 'Push B', 'Pull A', 'Pull B', 'Legs A', 'Legs B']);
    const exercises = await listExercises({});
    expect(exercises.length).toBeGreaterThan(300);
    const vb = await listExercises({ search: 'Volleyball' });
    expect(vb.some((e) => e.category === 'cardio' && e.met === 4)).toBe(true);
    const pushA = await getRoutineDetail(routines[0].id);
    expect(pushA!.exercises).toHaveLength(5);
    expect(pushA!.exercises[0].sets).toHaveLength(4);
    expect(pushA!.exercises[0].sets[0].target_reps_min).toBe(5);
  });

  it('is idempotent', async () => {
    const before = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM exercise`);
    const { seedExercises, seedRoutines } = await import('../src/db/seed');
    await seedExercises(db);
    await seedRoutines(db);
    const after = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM exercise`);
    expect(after!.n).toBe(before!.n);
    expect((await listRoutines()).length).toBe(6);
  });
});

describe('previous sets', () => {
  it('returns the latest finished session, skipping unfinished ones', async () => {
    const t0 = Date.parse('2026-01-05T10:00:00Z');
    await logSession('Bench Press (Barbell)', [[60, 7], [60, 7]], t0);
    await logSession('Bench Press (Barbell)', [[62.5, 6], [62.5, 6], [62.5, 5]], t0 + 3 * 86400_000);
    // unfinished session on top should be ignored
    const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Bench Press (Barbell)'`);
    const wId = await createWorkout('Draft', null);
    await addExerciseToWorkout(wId, ex!.id, null);
    const prev = await previousSets(ex!.id);
    expect(prev).toHaveLength(3);
    expect(prev[0].weight_kg).toBe(62.5);
    expect(prev[2].reps).toBe(5);
  });

  it('is empty for a never-trained exercise', async () => {
    const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Squat (Barbell)'`);
    expect(await previousSets(ex!.id)).toHaveLength(0);
  });

  it('prefills a routine start from the previous session', async () => {
    const t0 = Date.parse('2026-02-01T10:00:00Z');
    await logSession('Bench Press (Barbell)', [[80, 6], [80, 6], [80, 5], [80, 5]], t0);
    const routines = await listRoutines();
    const wId = await startFromRoutine(routines[0].id); // Push A starts with Bench Press (Barbell)
    const detail = await getWorkoutDetail(wId!);
    const bench = detail!.exercises[0];
    expect(bench.exercise.name).toBe('Bench Press (Barbell)');
    expect(bench.sets).toHaveLength(4);
    expect(bench.sets[0].weight_kg).toBe(80);
    expect(bench.sets[0].is_completed).toBe(0);
  });
});

describe('finish + PRs', () => {
  it('computes totals, drops untouched sets, counts PRs', async () => {
    const t = Date.parse('2026-03-01T10:00:00Z');
    const wId = await logSession('Bench Press (Barbell)', [[60, 8], [65, 6]], t);
    const w = await db.get<{ total_volume_kg: number; total_sets: number; pr_count: number; duration_s: number }>(
      `SELECT total_volume_kg, total_sets, pr_count, duration_s FROM workout WHERE id = ?`, [wId]);
    expect(w!.total_volume_kg).toBe(60 * 8 + 65 * 6);
    expect(w!.total_sets).toBe(2);
    expect(w!.duration_s).toBe(3600);
    // first session: weight, e1rm, set_volume, reps PRs all new
    expect(w!.pr_count).toBe(4);
  });

  it('only better values create new PRs', async () => {
    const t = Date.parse('2026-03-01T10:00:00Z');
    await logSession('Bench Press (Barbell)', [[60, 8]], t);
    const w2 = await logSession('Bench Press (Barbell)', [[55, 8]], t + 86400_000); // strictly worse
    const row = await db.get<{ pr_count: number }>(`SELECT pr_count FROM workout WHERE id = ?`, [w2]);
    expect(row!.pr_count).toBe(0);
    const w3 = await logSession('Bench Press (Barbell)', [[62.5, 8]], t + 2 * 86400_000);
    const row3 = await db.get<{ pr_count: number }>(`SELECT pr_count FROM workout WHERE id = ?`, [w3]);
    // weight up, e1rm up, volume up, reps ties (8) -> 3 PRs
    expect(row3!.pr_count).toBe(3);
    const bests = await bestsForExercise((await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Bench Press (Barbell)'`))!.id);
    expect(bests.weight!.value).toBe(62.5);
    expect(bests.reps!.value).toBe(8);
  });

  it('rebuildAllPrs matches incremental detection after a deletion', async () => {
    const t = Date.parse('2026-03-01T10:00:00Z');
    await logSession('Bench Press (Barbell)', [[60, 8]], t);
    const w2 = await logSession('Bench Press (Barbell)', [[70, 6]], t + 86400_000);
    await logSession('Bench Press (Barbell)', [[65, 6]], t + 2 * 86400_000);
    await deleteWorkout(w2);
    await rebuildAllPrs(db);
    const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Bench Press (Barbell)'`);
    const bests = await bestsForExercise(ex!.id);
    expect(bests.weight!.value).toBe(65); // 70 disappeared with the deleted workout
  });

  it('cardio sets record duration PRs and calories', async () => {
    const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Badminton'`);
    const wId = await createWorkout('Sports', null);
    const t = Date.parse('2026-04-01T18:00:00Z');
    await db.run(`UPDATE workout SET started_at = ? WHERE id = ?`, [t, wId]);
    const weId = await addExerciseToWorkout(wId, ex!.id, null);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await updateSet(s!.id, { durationS: 3600, isCompleted: true });
    const res = await finishWorkout(wId, { name: 'Sports', notes: '', finishedAt: t + 3600_000, bodyWeightKg: 70.8 });
    // badminton MET 5.5 x 70.8kg x 1h = 389 kcal; no strength time left over
    expect(res.caloriesKcal).toBe(389);
    expect(res.prCount).toBe(1); // duration PR
    const w = await db.get<{ total_volume_kg: number }>(`SELECT total_volume_kg FROM workout WHERE id = ?`, [wId]);
    expect(w!.total_volume_kg).toBe(0);
  });
});

describe('calories', () => {
  it('Mifflin-St Jeor matches reference values', () => {
    // 70.8kg, 177.8cm, 28y male -> 708 + 1111.25 - 140 + 5 = 1684
    expect(mifflinBmr('male', 70.8, 177.8, 28)).toBe(1684);
    expect(mifflinBmr('female', 60, 165, 30)).toBe(10 * 60 + Math.round(6.25 * 165) - 150 - 161);
  });

  it('epley', () => {
    expect(epley1Rm(100, 1)).toBe(100);
    expect(epley1Rm(100, 5)).toBeCloseTo(116.67, 1);
  });

  it('workout kcal splits strength and cardio time', () => {
    const kcal = workoutKcal({
      durationS: 5400, // 90 min total
      cardioSets: [{ met: 5.5, durationS: 1800 }], // 30 min badminton
      bodyWeightKg: 70,
    });
    // 60min strength @5.0 = 350; 30min badminton @5.5 = 192.5 -> 543
    expect(kcal).toBe(Math.round(350 + 192.5));
  });

  it('daily budget with measured BMR override and gain goal', () => {
    const b = dailyBudget({
      sex: 'male', birthYear: 1998, heightCm: 177.8, weightKg: 70.8,
      bmrOverride: 1637, activityFactor: 1.375, goalWeightKg: 75, goalRateKgPerWeek: 0.25,
    }, 400, Date.parse('2026-08-22T12:00:00Z'));
    expect(b!.bmr).toBe(1637);
    expect(b!.baseTdee).toBe(Math.round(1637 * 1.375)); // 2251
    expect(b!.direction).toBe('gain');
    expect(b!.adjustment).toBe(Math.round(0.25 * 7700 / 7)); // 275
    expect(b!.targetIntake).toBe(b!.baseTdee + 400 + 275);
    expect(b!.macros.proteinG).toBe(Math.round(b!.targetIntake * 0.3 / 4));
  });

  it('daily budget needs profile data', () => {
    expect(dailyBudget({ sex: null, birthYear: null, heightCm: null, weightKg: null, bmrOverride: null, activityFactor: 1.2, goalWeightKg: null, goalRateKgPerWeek: 0 }, 0)).toBeNull();
  });
});

describe('csv export', () => {
  it('exports completed sets in range with escaping', async () => {
    const t = Date.parse('2026-05-10T10:00:00Z');
    const wId = await logSession('Bench Press (Barbell)', [[60, 8]], t);
    await db.run(`UPDATE workout SET notes = ? WHERE id = ?`, ['felt "great", solid', wId]);
    await logSession('Squat (Barbell)', [[100, 5]], t + 40 * 86400_000); // outside range
    const csv = await exportCsv(t - 86400_000, t + 86400_000);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('title,start_time');
    expect(lines[1]).toContain('Bench Press (Barbell)');
    expect(lines[1]).toContain('"felt ""great"", solid"');
    expect(lines[1]).toContain('480'); // volume 60x8
  });

  it('range boundaries are [from, to)', async () => {
    const t = Date.parse('2026-05-10T00:00:00Z');
    await logSession('Bench Press (Barbell)', [[60, 8]], t);
    expect((await exportCsv(t, t + 1)).trim().split('\r\n')).toHaveLength(2);
    expect((await exportCsv(t + 1, t + 2)).trim().split('\r\n')).toHaveLength(1);
    expect((await exportCsv(t - 2, t)).trim().split('\r\n')).toHaveLength(1);
  });
});

describe('backup / restore', () => {
  it('round-trips the whole database', async () => {
    const t = Date.parse('2026-06-01T10:00:00Z');
    await logSession('Bench Press (Barbell)', [[60, 8], [65, 6]], t);
    await db.run(`INSERT INTO setting (key, value) VALUES ('unit', 'lb')`);
    const backup = await createBackup();
    const json = JSON.parse(JSON.stringify(backup)); // simulate file round-trip
    const restored = validateBackup(json);

    const db2 = await freshDb({ seed: false });
    await restoreBackup(restored);
    for (const t2 of ['exercise', 'workout', 'workout_set', 'personal_record', 'routine', 'routine_set', 'setting'] as const) {
      const a = backup.tables[t2].length;
      const b = (await db2.all(`SELECT * FROM ${t2}`)).length;
      expect(`${t2}:${b}`).toBe(`${t2}:${a}`);
    }
    const w = await db2.get<{ total_volume_kg: number }>(`SELECT total_volume_kg FROM workout LIMIT 1`);
    expect(w!.total_volume_kg).toBe(60 * 8 + 65 * 6);
  });

  it('rejects foreign or newer files', () => {
    expect(() => validateBackup({ app: 'other' })).toThrow();
    expect(() => validateBackup({ app: 'lifty', schema_version: 999, tables: {} })).toThrow('newer');
  });
});

describe('stats', () => {
  it('week streak and sessions per week', async () => {
    const now = Date.parse('2026-08-22T12:00:00Z'); // Saturday
    const mon = Date.parse('2026-08-17T10:00:00Z');
    await logSession('Bench Press (Barbell)', [[60, 8]], mon);          // this week
    await logSession('Squat (Barbell)', [[100, 5]], mon - 7 * 86400_000);   // last week
    await logSession('Squat (Barbell)', [[100, 5]], mon - 21 * 86400_000);  // gap at -14
    expect(await weekStreak(now)).toBe(2);
    const weeks = await sessionsPerWeek(4, now);
    expect(weeks).toHaveLength(4);
    expect(weeks[3].count).toBe(1);
    expect(weeks[1].count).toBe(0);
  });

  it('kcalToday only counts today', async () => {
    const now = Date.parse('2026-08-22T20:00:00Z');
    await logSession('Bench Press (Barbell)', [[60, 8]], Date.parse('2026-08-22T08:00:00Z'));
    await logSession('Squat (Barbell)', [[100, 5]], Date.parse('2026-08-21T08:00:00Z'));
    const kcal = await kcalToday(now);
    // one 60-min strength session @5 MET x 70kg = 350
    expect(kcal).toBe(350);
  });

  it('exercise trend returns best e1rm per session ascending', async () => {
    const t = Date.parse('2026-07-01T10:00:00Z');
    await logSession('Bench Press (Barbell)', [[60, 8]], t);
    await logSession('Bench Press (Barbell)', [[65, 6]], t + 86400_000);
    const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Bench Press (Barbell)'`);
    const trend = await exerciseTrend(ex!.id, 'e1rm', 0);
    expect(trend).toHaveLength(2);
    expect(trend[0].value).toBeCloseTo(76, 0);
    expect(trend[1].t).toBeGreaterThan(trend[0].t);
  });
});

describe('crash recovery', () => {
  it('finds the unfinished workout', async () => {
    expect(await findUnfinishedWorkout()).toBeNull();
    const routines = await listRoutines();
    const wId = await startFromRoutine(routines[0].id);
    const found = await findUnfinishedWorkout();
    expect(found!.id).toBe(wId);
  });
});

describe('settings persistence', () => {
  it('profile survives a save and reload', async () => {
    const { loadSettings, saveProfile, setSetting } = await import('../src/repo/settings');
    await saveProfile({
      sex: 'male', birthYear: 1998, heightCm: 177.8, weightKg: 70.8,
      bmrOverride: 1637, activityFactor: 1.375, goalWeightKg: 75, goalRateKgPerWeek: 0.25,
    });
    await setSetting('unit', 'lb');
    const s = await loadSettings();
    expect(s.profile.weightKg).toBe(70.8);
    expect(s.profile.goalWeightKg).toBe(75);
    expect(s.profile.bmrOverride).toBe(1637);
    expect(s.profile.sex).toBe('male');
    expect(s.unit).toBe('lb');
  });

  it('clearing a profile field persists as empty, not as a stale value', async () => {
    const { loadSettings, saveProfile } = await import('../src/repo/settings');
    const base = {
      sex: 'male' as const, birthYear: 1998, heightCm: 177.8, weightKg: 70.8,
      bmrOverride: 1637, activityFactor: 1.375, goalWeightKg: 75, goalRateKgPerWeek: 0.25,
    };
    await saveProfile(base);
    await saveProfile({ ...base, goalWeightKg: null });
    const s = await loadSettings();
    expect(s.profile.goalWeightKg).toBeNull();
    expect(s.profile.weightKg).toBe(70.8);
  });
});
