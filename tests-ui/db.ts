/// <reference types="jest" />
import Database from 'better-sqlite3';
import { migrate, setDb, type SqlDriver } from '../src/db/database';
import { seedExercises, seedRoutines } from '../src/db/seed';

let openHandle: Database.Database | null = null;

/**
 * better-sqlite3 behind the async SqlDriver interface.
 *
 * The gap between statements is a MACROTASK: a microtask gap never yields to the
 * timer queue, so a long chain of queries starves the timers RTL's findBy* polling
 * depends on and screens appear never to render. Seeding bypasses the gap — it is
 * a one-shot bulk load, and 729 macrotasks per test compounds across a file.
 */
export function asyncDriver(): SqlDriver & { setBulk(on: boolean): void; close(): void } {
  const db = new Database(':memory:');
  openHandle?.close();
  openHandle = db;

  let bulk = false;
  const gap = () => (bulk ? Promise.resolve() : new Promise((r) => setImmediate(r)));
  let depth = 0;
  let tail: Promise<unknown> = Promise.resolve();

  const lane = <T>(op: () => Promise<T>): Promise<T> => {
    if (depth > 0) return op();
    const run = tail.then(op, op);
    tail = run.then(() => undefined, () => undefined);
    return run;
  };

  return {
    setBulk: (on: boolean) => { bulk = on; },
    close: () => db.close(),
    exec: (sql) => lane(async () => { await gap(); db.exec(sql); }),
    run: (sql, params = []) => lane(async () => {
      await gap();
      const r = db.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    }),
    all: ((sql: string, p: unknown[] = []) => lane(async () => {
      await gap();
      const st = db.prepare(sql);
      return st.reader ? st.all(...(p as never[])) : (st.run(...(p as never[])), []);
    })) as never,
    get: ((sql: string, p: unknown[] = []) => lane(async () => {
      await gap();
      const st = db.prepare(sql);
      if (!st.reader) { st.run(...(p as never[])); return null; }
      return st.get(...(p as never[])) ?? null;
    })) as never,
    transaction: (fn) => lane(async () => {
      if (depth > 0) return (await fn()) as never;
      depth++;
      try {
        db.exec('SAVEPOINT tx');
        await gap();
        const out = await fn();
        await gap();
        db.exec('RELEASE tx');
        return out as never;
      } catch (e) {
        db.exec('ROLLBACK TO tx'); db.exec('RELEASE tx');
        throw e;
      } finally { depth--; }
    }),
  };
}

export async function prepareDb(opts: { seed?: boolean } = {}): Promise<SqlDriver> {
  const db = asyncDriver();
  await migrate(db);
  setDb(db);
  if (opts.seed !== false) {
    db.setBulk(true);
    await seedExercises(db);
    await seedRoutines(db);
    db.setBulk(false);
  }
  return db;
}
