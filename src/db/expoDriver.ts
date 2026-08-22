import * as SQLite from 'expo-sqlite';
import type { SqlDriver } from './database';

export async function openExpoDriver(name = 'lifty.db'): Promise<SqlDriver> {
  const db = await SQLite.openDatabaseAsync(name);
  return {
    async exec(sql) {
      await db.execAsync(sql);
    },
    async run(sql, params = []) {
      const r = await db.runAsync(sql, params);
      return { lastInsertRowId: r.lastInsertRowId, changes: r.changes };
    },
    async all(sql, params = []) {
      return db.getAllAsync(sql, params);
    },
    async get(sql, params = []) {
      return db.getFirstAsync(sql, params);
    },
    async transaction(fn) {
      let out: unknown;
      await db.withTransactionAsync(async () => {
        out = await fn();
      });
      return out as never;
    },
  };
}
