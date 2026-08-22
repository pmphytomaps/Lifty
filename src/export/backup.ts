import { getDb } from '../db/database';
import { SCHEMA_VERSION } from '../db/schema';
import { rebuildAllPrs } from '../repo/prs';

const TABLES = [
  'exercise', 'routine_folder', 'routine', 'routine_exercise', 'routine_set',
  'workout', 'workout_exercise', 'workout_set', 'personal_record', 'setting',
] as const;

export interface BackupFile {
  app: 'lifty';
  schema_version: number;
  exported_at: number;
  tables: Record<string, Record<string, unknown>[]>;
}

export async function createBackup(): Promise<BackupFile> {
  const db = getDb();
  const tables: BackupFile['tables'] = {};
  for (const t of TABLES) tables[t] = await db.all(`SELECT * FROM ${t}`);
  return { app: 'lifty', schema_version: SCHEMA_VERSION, exported_at: Date.now(), tables };
}

export function validateBackup(raw: unknown): BackupFile {
  const b = raw as BackupFile;
  if (!b || b.app !== 'lifty' || typeof b.schema_version !== 'number' || !b.tables) {
    throw new Error('Not a Lifty backup file');
  }
  if (b.schema_version > SCHEMA_VERSION) {
    throw new Error('Backup was made by a newer version of Lifty — update the app first');
  }
  return b;
}

/** Replaces everything. Insert order respects FKs; unknown columns are dropped. */
export async function restoreBackup(b: BackupFile): Promise<void> {
  const db = getDb();
  await db.transaction(async () => {
    for (const t of [...TABLES].reverse()) await db.run(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      const rows = b.tables[t] ?? [];
      if (!rows.length) continue;
      const info = await db.all<{ name: string }>(`PRAGMA table_info(${t})`);
      const known = new Set(info.map((c) => c.name));
      for (const row of rows) {
        const cols = Object.keys(row).filter((c) => known.has(c));
        if (!cols.length) continue;
        await db.run(
          `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((c) => row[c] as string | number | null),
        );
      }
    }
  });
  await rebuildAllPrs(db);
}
