import * as SQLite from 'expo-sqlite';
import type { SqlDriver } from './database';

/**
 * expo-sqlite's withTransactionAsync is a bare BEGIN/COMMIT with no locking —
 * its own docs say it "is not exclusive and can be interrupted by other async
 * queries". Two overlapping operations therefore produce "cannot start a
 * transaction within a transaction", and the failing branch's ROLLBACK discards
 * the other transaction's work, leaving the connection with a lost COMMIT and a
 * write lock nothing releases. Every later query then fails or hangs, which is
 * indistinguishable from dead buttons.
 *
 * So every operation enters through a single-lane queue. Because only one queued
 * operation ever runs at a time, any call that observes `inTransaction` must be a
 * re-entrant call from inside the running transaction body, and is let straight
 * through rather than deadlocking behind the transaction that spawned it.
 */
export async function openExpoDriver(name = 'lifty.db'): Promise<SqlDriver> {
  const db = await SQLite.openDatabaseAsync(name);

  let tail: Promise<unknown> = Promise.resolve();
  let txDepth = 0;

  const serialize = <T>(op: () => Promise<T>): Promise<T> => {
    if (txDepth > 0) return op();
    const run = tail.then(op, op);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  return {
    exec(sql) {
      return serialize(async () => {
        await db.execAsync(sql);
      });
    },

    run(sql, params = []) {
      return serialize(async () => {
        const r = await db.runAsync(sql, params);
        return { lastInsertRowId: r.lastInsertRowId, changes: r.changes };
      });
    },

    all(sql, params = []) {
      return serialize(() => db.getAllAsync(sql, params)) as never;
    },

    get(sql, params = []) {
      return serialize(async () => (await db.getFirstAsync(sql, params)) ?? null) as never;
    },

    transaction(fn) {
      return serialize(async () => {
        // SQLite has no nested transactions, and a depth counter rather than a
        // boolean matters: a nested call finishing would clear a shared flag and
        // send the OUTER body's remaining queries back into the queue, where they
        // would wait forever on the transaction that spawned them.
        if (txDepth > 0) return (await fn()) as never;

        txDepth++;
        try {
          let out: unknown;
          // Deliberately NOT withExclusiveTransactionAsync: it opens a second
          // connection (useNewConnection: true), and PRAGMA foreign_keys is
          // per-connection, so cascade deletes would silently stop firing and
          // orphan rows. The queue above already guarantees exclusivity on this
          // one connection, which is what was actually missing.
          await db.withTransactionAsync(async () => {
            out = await fn();
          });
          return out as never;
        } finally {
          txDepth--;
        }
      });
    },
  };
}
