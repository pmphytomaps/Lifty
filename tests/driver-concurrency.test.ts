/**
 * Reproduces the interleaving that wedged the database on device.
 *
 * expo-sqlite's withTransactionAsync issues a bare BEGIN/COMMIT with no lock, so
 * a second operation starting mid-transaction raises "cannot start a transaction
 * within a transaction", and that branch's ROLLBACK throws away the first
 * transaction's work. The driver must make this impossible by serializing.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SqlDriver } from '../src/db/database';

/** A driver whose transaction() mimics expo-sqlite: BEGIN/COMMIT, no locking. */
function makeDriver(serialized: boolean): SqlDriver & { log: string[] } {
  const log: string[] = [];
  let depth = 0;
  let tail: Promise<unknown> = Promise.resolve();
  let txDepth = 0;

  const tick = () => new Promise((r) => setTimeout(r, 0));

  const raw = {
    async begin() {
      if (depth > 0) throw new Error('cannot start a transaction within a transaction');
      depth++;
      log.push('BEGIN');
    },
    async commit() {
      if (depth === 0) throw new Error('cannot commit - no transaction is active');
      depth--;
      log.push('COMMIT');
    },
    async rollback() {
      if (depth === 0) throw new Error('cannot rollback - no transaction is active');
      depth--;
      log.push('ROLLBACK');
    },
  };

  const serialize = <T>(op: () => Promise<T>): Promise<T> => {
    if (!serialized) return op();
    if (txDepth > 0) return op();
    const run = tail.then(op, op);
    tail = run.then(() => undefined, () => undefined);
    return run;
  };

  const d = {
    log,
    async exec() {},
    async run() {
      return { lastInsertRowId: 0, changes: 0 };
    },
    async all() {
      return [] as never;
    },
    async get() {
      return null as never;
    },
    transaction(fn: () => Promise<unknown>) {
      return serialize(async () => {
        if (serialized && txDepth > 0) return (await fn()) as never;
        txDepth++;
        try {
          await raw.begin();
          // Awaits inside the body are where another operation can slip in.
          await tick();
          const out = await fn();
          await tick();
          await raw.commit();
          return out as never;
        } catch (e) {
          await raw.rollback().catch(() => {});
          throw e;
        } finally {
          txDepth--;
        }
      });
    },
  };
  return d as SqlDriver & { log: string[] };
}

describe('database driver concurrency', () => {
  it('unserialized access corrupts transaction nesting (the shipped bug)', async () => {
    const db = makeDriver(false);
    const results = await Promise.allSettled([
      db.transaction(async () => 'a'),
      db.transaction(async () => 'b'),
    ]);

    // Both transactions are damaged: the second cannot BEGIN, and its ROLLBACK
    // pops the FIRST one's transaction, so the first cannot COMMIT either.
    const failed = results.filter((r) => r.status === 'rejected');
    expect(failed.length).toBe(2);
    const reasons = failed.map((r) => String((r as PromiseRejectedResult).reason)).join(' | ');
    expect(reasons).toContain('within a transaction');
    expect(reasons).toContain('no transaction is active');

    // A rollback landed without a matching commit: work was silently discarded.
    expect(db.log).toContain('ROLLBACK');
    expect(db.log.filter((l) => l === 'COMMIT')).toHaveLength(0);
  });

  it('serialized access runs overlapping transactions cleanly', async () => {
    const db = makeDriver(true);
    const results = await Promise.allSettled([
      db.transaction(async () => 'a'),
      db.transaction(async () => 'b'),
      db.transaction(async () => 'c'),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(results.map((r) => (r as PromiseFulfilledResult<string>).value)).toEqual(['a', 'b', 'c']);
    expect(db.log).toEqual(['BEGIN', 'COMMIT', 'BEGIN', 'COMMIT', 'BEGIN', 'COMMIT']);
  });

  it('a failing transaction does not poison the ones after it', async () => {
    const db = makeDriver(true);
    const boom = db.transaction(async () => {
      throw new Error('boom');
    });
    const after = db.transaction(async () => 'ok');
    await expect(boom).rejects.toThrow('boom');
    await expect(after).resolves.toBe('ok');
    expect(db.log).toEqual(['BEGIN', 'ROLLBACK', 'BEGIN', 'COMMIT']);
  });

  it('a nested transaction joins the outer one instead of deadlocking', async () => {
    const db = makeDriver(true);
    const out = await Promise.race([
      db.transaction(async () => {
        await db.run('INSERT INTO t VALUES (1)');
        // A repository helper that itself opens a transaction.
        await db.transaction(async () => {
          await db.run('INSERT INTO t VALUES (2)');
        });
        // The outer body must still be able to talk to the database afterwards.
        await db.get('SELECT 1');
        return 'done';
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DEADLOCK')), 1500)),
    ]);
    expect(out).toBe('done');
    // Exactly one BEGIN/COMMIT pair: the nested call must not issue its own.
    expect(db.log).toEqual(['BEGIN', 'COMMIT']);
  });

  it('re-entrant calls inside a transaction body do not deadlock', async () => {
    const db = makeDriver(true);
    const out = await Promise.race([
      db.transaction(async () => {
        await db.run('INSERT INTO t VALUES (1)');
        await db.get('SELECT 1');
        await db.all('SELECT 1');
        return 'done';
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DEADLOCK')), 1500)),
    ]);
    expect(out).toBe('done');
  });
});

describe('shipped driver shape', () => {
  it('serializes and guards re-entrancy', () => {
    const src = readFileSync('src/db/expoDriver.ts', 'utf8');
    expect(src).toMatch(/const serialize =/);
    expect(src).toMatch(/inTransaction/);
    // Must NOT use the exclusive variant: it opens a second connection and
    // loses PRAGMA foreign_keys, silently disabling cascade deletes.
    expect(src).not.toMatch(/await db\.withExclusiveTransactionAsync/);
    // Every public method must go through the queue.
    for (const m of ['exec(sql)', 'run(sql, params = [])', 'all(sql, params = [])', 'get(sql, params = [])']) {
      const body = src.slice(src.indexOf(m));
      expect(body.slice(0, 200)).toMatch(/serialize\(/);
    }
  });
});
