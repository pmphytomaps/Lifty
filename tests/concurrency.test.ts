/**
 * Concurrent operations through the REAL repositories, on a driver that puts a
 * genuine macrotask between statements the way expo-sqlite's bridge does.
 *
 * The suite that shipped the wedging bug ran every repository call one at a time
 * on a synchronous database, so overlapping work was impossible to express.
 */
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { migrate, setDb, type SqlDriver } from '../src/db/database';
import { seedExercises, seedRoutines } from '../src/db/seed';
import { listExercises } from '../src/repo/exercises';
import { listRoutines } from '../src/repo/routines';
import { allTimeTotals, weekStreak } from '../src/repo/stats';
import {
  addExerciseToWorkout, createWorkout, discardWorkout, finishWorkout,
  findUnfinishedWorkout, previousSets, startFromRoutine, updateSet,
} from '../src/repo/workouts';

/** Serialized exactly as the shipped driver is, with a real async gap per statement. */
function bridgeDriver(serialized: boolean): SqlDriver {
  const db = new Database(':memory:');
  const hop = () => new Promise((r) => setImmediate(r));
  let depth = 0;
  let tail: Promise<unknown> = Promise.resolve();

  const lane = <T>(op: () => Promise<T>): Promise<T> => {
    if (!serialized) return op();
    if (depth > 0) return op();
    const run = tail.then(op, op);
    tail = run.then(() => undefined, () => undefined);
    return run;
  };

  return {
    exec: (sql) => lane(async () => { await hop(); db.exec(sql); }),
    run: (sql, params = []) => lane(async () => {
      await hop();
      const r = db.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    }),
    all: ((sql: string, p: unknown[] = []) => lane(async () => {
      await hop();
      const st = db.prepare(sql);
      return st.reader ? st.all(...(p as never[])) : (st.run(...(p as never[])), []);
    })) as never,
    get: ((sql: string, p: unknown[] = []) => lane(async () => {
      await hop();
      const st = db.prepare(sql);
      if (!st.reader) { st.run(...(p as never[])); return null; }
      return st.get(...(p as never[])) ?? null;
    })) as never,
    transaction: (fn) => lane(async () => {
      // The unserialized variant has no re-entrancy guard, matching expo-sqlite,
      // so overlapping callers each issue their own BEGIN.
      if (serialized && depth > 0) return (await fn()) as never;
      depth++;
      try {
        // Bare BEGIN/COMMIT, exactly as expo-sqlite's withTransactionAsync does:
        // SQLite rejects a nested BEGIN, which is the failure the shipped app hit.
        db.exec('BEGIN');
        await hop();
        const out = await fn();
        await hop();
        db.exec('COMMIT');
        return out as never;
      } catch (e) {
        try { db.exec('ROLLBACK'); } catch { /* nothing to roll back */ }
        throw e;
      } finally { depth--; }
    }),
  };
}

async function boot(serialized = true): Promise<SqlDriver> {
  const db = bridgeDriver(serialized);
  await migrate(db);
  setDb(db);
  await seedExercises(db);
  await seedRoutines(db);
  return db;
}

let db: SqlDriver;
beforeEach(async () => {
  db = await boot();
});

describe('overlapping work through the real repositories', () => {
  it('starting a routine while the tab reloads leaves consistent data', async () => {
    const routines = await listRoutines();
    // Exactly what the Workout tab does: a focus reload racing a start.
    const [wId] = await Promise.all([
      startFromRoutine(routines[0].id),
      listRoutines(),
      findUnfinishedWorkout(),
      listExercises({ search: 'press' }),
    ]);
    expect(wId).toBeTruthy();
    const sets = await db.all<{ n: number }>(
      `SELECT COUNT(*) AS n FROM workout_set ws JOIN workout_exercise we ON we.id = ws.workout_exercise_id WHERE we.workout_id = ?`,
      [wId!],
    );
    expect((sets[0] as unknown as { n: number }).n).toBeGreaterThan(0);
  });

  it('two routine starts at once both complete without corrupting each other', async () => {
    const routines = await listRoutines();
    const results = await Promise.allSettled([
      startFromRoutine(routines[0].id),
      startFromRoutine(routines[1].id),
      startFromRoutine(routines[2].id),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const rows = await db.all(`SELECT id FROM workout`);
    expect(rows).toHaveLength(3);
    // Every exercise row must belong to a workout that exists.
    const orphans = await db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM workout_exercise WHERE workout_id NOT IN (SELECT id FROM workout)`);
    expect(orphans!.n).toBe(0);
  });

  it('finishing while queries run in parallel still records totals and PRs', async () => {
    const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Bench Press (Barbell)'`);
    const wId = await createWorkout('Push A', null);
    const weId = await addExerciseToWorkout(wId, ex!.id, 120);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await updateSet(s!.id, { weightKg: 80, reps: 5, isCompleted: true });

    const [res] = await Promise.all([
      finishWorkout(wId, { name: 'Push A', notes: '', finishedAt: Date.now(), bodyWeightKg: 70 }),
      allTimeTotals(),
      weekStreak(),
      listExercises({ search: 'squat' }),
      previousSets(ex!.id),
    ]);
    expect(res.prCount).toBeGreaterThan(0);
    const w = await db.get<{ total_sets: number; total_volume_kg: number }>(
      `SELECT total_sets, total_volume_kg FROM workout WHERE id = ?`, [wId]);
    expect(w!.total_sets).toBe(1);
    expect(w!.total_volume_kg).toBe(400);
  });

  it('a burst of set edits all land, as when typing a weight', async () => {
    const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Squat (Barbell)'`);
    const wId = await createWorkout('Legs A', null);
    const weId = await addExerciseToWorkout(wId, ex!.id, 120);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);

    // "1", "10", "100" typed quickly, plus a completion toggle.
    await Promise.all([
      updateSet(s!.id, { weightKg: 1 }),
      updateSet(s!.id, { weightKg: 10 }),
      updateSet(s!.id, { weightKg: 100 }),
      updateSet(s!.id, { reps: 5 }),
      updateSet(s!.id, { isCompleted: true }),
    ]);
    const row = await db.get<{ weight_kg: number; reps: number; is_completed: number }>(
      `SELECT weight_kg, reps, is_completed FROM workout_set WHERE id = ?`, [s!.id]);
    expect(row!.reps).toBe(5);
    expect(row!.is_completed).toBe(1);
    expect([1, 10, 100]).toContain(row!.weight_kg); // last writer wins, never lost
  });

  it('discarding while the tab polls removes the workout exactly once', async () => {
    const routines = await listRoutines();
    const wId = await startFromRoutine(routines[0].id);
    const [, found] = await Promise.all([
      discardWorkout(wId!),
      findUnfinishedWorkout(),
      listRoutines(),
    ]);
    expect(found === null || found!.id === wId).toBe(true);
    expect(await findUnfinishedWorkout()).toBeNull();
    const leftovers = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM workout_exercise`);
    expect(leftovers!.n).toBe(0);
  });

  it('seeding is safe even if a query races it', async () => {
    const fresh = bridgeDriver(true);
    await migrate(fresh);
    setDb(fresh);
    await Promise.all([
      seedExercises(fresh),
      seedRoutines(fresh),
      listExercises({ search: 'bench' }).catch(() => []),
    ]);
    const n = await fresh.get<{ n: number }>(`SELECT COUNT(*) AS n FROM exercise`);
    expect(n!.n).toBeGreaterThan(700);
    expect((await listRoutines()).length).toBe(6);
  });
});

describe('without serialization the same work corrupts', () => {
  it('demonstrates why the driver must hold a single lane', async () => {
    const unsafe = bridgeDriver(false);
    await migrate(unsafe);
    setDb(unsafe);
    await seedExercises(unsafe);
    await seedRoutines(unsafe);
    const routines = await listRoutines();

    const results = await Promise.allSettled([
      startFromRoutine(routines[0].id),
      startFromRoutine(routines[1].id),
      startFromRoutine(routines[2].id),
    ]);
    const failed = results.filter((r) => r.status === 'rejected');
    expect(failed.length).toBeGreaterThan(0);
    expect(String((failed[0] as PromiseRejectedResult).reason)).toMatch(/transaction|cannot/i);
  });
});
