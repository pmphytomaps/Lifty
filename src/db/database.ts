import { MIGRATIONS, SCHEMA_VERSION } from './schema';

/** Minimal async SQL surface implemented by expo-sqlite on device and better-sqlite3 in tests. */
export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: (string | number | null)[]): Promise<{ lastInsertRowId: number; changes: number }>;
  all<T = Record<string, unknown>>(sql: string, params?: (string | number | null)[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: (string | number | null)[]): Promise<T | null>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

export async function migrate(db: SqlDriver): Promise<void> {
  await db.exec('PRAGMA journal_mode = WAL');
  await db.exec('PRAGMA foreign_keys = ON');
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;
  await db.transaction(async () => {
    for (let v = current; v < SCHEMA_VERSION; v++) {
      for (const stmt of MIGRATIONS[v]) await db.exec(stmt);
    }
    await db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}

let _db: SqlDriver | null = null;

export function setDb(db: SqlDriver): void {
  _db = db;
}

export function getDb(): SqlDriver {
  if (!_db) throw new Error('Database not initialised');
  return _db;
}
