import { migrate, setDb, type SqlDriver } from '../src/db/database';
import { seedExercises, seedRoutines } from '../src/db/seed';
import { memoryDriver } from './driver';

export async function freshDb(opts: { seed?: boolean } = {}): Promise<SqlDriver> {
  const db = memoryDriver();
  await migrate(db);
  setDb(db);
  if (opts.seed !== false) {
    await seedExercises(db);
    await seedRoutines(db);
  }
  return db;
}
