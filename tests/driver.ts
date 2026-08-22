import Database from 'better-sqlite3';
import type { SqlDriver } from '../src/db/database';

/** Test driver backed by better-sqlite3 (sync engine behind the async interface). */
export function memoryDriver(): SqlDriver {
  const db = new Database(':memory:');
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, params = []) {
      const r = db.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    },
    async all(sql, params = []) {
      const stmt = db.prepare(sql);
      return (stmt.reader ? stmt.all(...params) : (stmt.run(...params), [])) as never;
    },
    async get(sql, params = []) {
      const stmt = db.prepare(sql);
      if (!stmt.reader) {
        stmt.run(...params);
        return null;
      }
      return (stmt.get(...params) ?? null) as never;
    },
    async transaction(fn) {
      // better-sqlite3 transactions are sync-only; emulate with SAVEPOINT.
      db.exec('SAVEPOINT sp');
      try {
        const out = await fn();
        db.exec('RELEASE sp');
        return out;
      } catch (e) {
        db.exec('ROLLBACK TO sp');
        db.exec('RELEASE sp');
        throw e;
      }
    },
  };
}
