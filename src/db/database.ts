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
  // Read these back: a PRAGMA that fails to apply is silent, and losing
  // foreign_keys means cascade deletes stop firing and orphan rows.
  await db.get('PRAGMA journal_mode = WAL');
  await db.exec('PRAGMA foreign_keys = ON');
  await db.exec('PRAGMA busy_timeout = 5000');

  const fk = await db.get<{ foreign_keys: number }>('PRAGMA foreign_keys');
  if (fk && fk.foreign_keys !== 1) {
    throw new Error('SQLite refused to enable foreign keys; refusing to continue');
  }

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
