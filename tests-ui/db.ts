import Database from 'better-sqlite3';
import { migrate, setDb, type SqlDriver } from '../src/db/database';
import { seedExercises, seedRoutines } from '../src/db/seed';

/**
 * better-sqlite3 behind the async SqlDriver interface, with a real await between
 * every statement so callers interleave the way they do on device.
 */
export function asyncDriver(opts: { slow?: boolean } = {}): SqlDriver {
  const db = new Database(':memory:');
  // A real await between statements so callers interleave as they do on device.
  // Microtask by default (fast enough to seed 729 rows inside a test); the
  // macrotask variant mimics expo-sqlite's bridge hop for concurrency tests.
  const gap = opts.slow
    ? () => new Promise((r) => setImmediate(r))
    : () => Promise.resolve();
  let depth = 0;
  let tail: Promise<unknown> = Promise.resolve();

  const serialize = <T>(op: () => Promise<T>): Promise<T> => {
    if (depth > 0) return op();
    const run = tail.then(op, op);
    tail = run.then(() => undefined, () => undefined);
    return run;
  };

  return {
    exec: (sql) => serialize(async () => { await gap(); db.exec(sql); }),
    run: (sql, params = []) => serialize(async () => {
      await gap();
      const r = db.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    }),
    all: ((sql: string, params: unknown[] = []) => serialize(async () => {
      await gap();
      const st = db.prepare(sql);
      return st.reader ? st.all(...(params as never[])) : (st.run(...(params as never[])), []);
    })) as never,
    get: ((sql: string, params: unknown[] = []) => serialize(async () => {
      await gap();
      const st = db.prepare(sql);
      if (!st.reader) { st.run(...(params as never[])); return null; }
      return st.get(...(params as never[])) ?? null;
    })) as never,
    transaction: (fn) => serialize(async () => {
      if (depth > 0) return (await fn()) as never;
      depth++;
      try {
        db.exec('SAVEPOINT sp');
        await gap();
        const out = await fn();
        await gap();
        db.exec('RELEASE sp');
        return out as never;
      } catch (e) {
        db.exec('ROLLBACK TO sp'); db.exec('RELEASE sp');
        throw e;
      } finally {
        depth--;
      }
    }),
  };
}

export async function prepareDb(opts: { seed?: boolean; slow?: boolean } = {}): Promise<SqlDriver> {
  const db = asyncDriver({ slow: opts.slow });
  await migrate(db);
  setDb(db);
  if (opts.seed !== false) {
    await seedExercises(db);
    await seedRoutines(db);
  }
  return db;
}
