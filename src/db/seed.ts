import type { SqlDriver } from './database';
import catalogJson from '../../assets/exercises.json';

interface CatalogEntry {
  id: string;
  name: string;
  equipment: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  category: string;
  met: number | null;
}

const catalog = catalogJson as CatalogEntry[];

/** Insert catalog exercises; idempotent, keeps user rows and catalog updates additive. */
export async function seedExercises(db: SqlDriver): Promise<void> {
  const row = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM exercise WHERE is_custom = 0`);
  if ((row?.n ?? 0) >= catalog.length) return;
  const now = Date.now();
  await db.transaction(async () => {
    for (const e of catalog) {
      await db.run(
        `INSERT OR IGNORE INTO exercise (id, name, equipment, primary_muscle, secondary_muscles, category, met, is_custom, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [e.id, e.name, e.equipment, e.primaryMuscle, JSON.stringify(e.secondaryMuscles), e.category, e.met, now],
      );
    }
  });
}

type SeedSet = [repsMin: number, repsMax: number];
interface SeedExercise { name: string; sets: SeedSet[]; note?: string }
interface SeedRoutine { name: string; exercises: SeedExercise[] }

const PPL: SeedRoutine[] = [
  { name: 'Push A', exercises: [
    { name: 'Bench Press (Barbell)', sets: [[5, 7], [5, 7], [5, 7], [5, 7]] },
    { name: 'Incline Bench Press (Dumbbell)', sets: [[8, 10], [8, 10], [8, 10]] },
    { name: 'Overhead Press (Barbell)', sets: [[6, 8], [6, 8], [6, 8]] },
    { name: 'Lateral Raise (Cable)', sets: [[12, 15], [12, 15], [12, 15]] },
    { name: 'Triceps Pushdown (Cable)', sets: [[10, 12], [10, 12], [10, 12]] },
  ]},
  { name: 'Push B', exercises: [
    { name: 'Incline Bench Press (Barbell)', sets: [[8, 10], [8, 10], [8, 10], [8, 10]] },
    { name: 'Shoulder Press (Dumbbell)', sets: [[8, 10], [8, 10], [8, 10]] },
    { name: 'Seated Chest Fly (Cable)', sets: [[12, 15], [12, 15], [12, 15]], note: 'Stretch-focused' },
    { name: 'Lateral Raise (Dumbbell)', sets: [[12, 15], [12, 15], [12, 15], [12, 15]] },
    { name: 'Overhead Triceps Extension (Cable)', sets: [[10, 12], [10, 12], [10, 12]], note: 'Long head' },
  ]},
  { name: 'Pull A', exercises: [
    { name: 'Pull Up', sets: [[6, 8], [6, 8], [6, 8], [6, 8]], note: 'Weighted when 4x8 is easy; lat pulldown as fallback' },
    { name: 'Bent Over Row (Barbell)', sets: [[6, 8], [6, 8], [6, 8], [6, 8]] },
    { name: 'Chest Supported Row (Machine)', sets: [[8, 10], [8, 10], [8, 10]] },
    { name: 'Back Extension (Weighted)', sets: [[10, 12], [10, 12], [10, 12]], note: '45 degree or GHD' },
    { name: 'Curl (Barbell)', sets: [[8, 10], [8, 10], [8, 10]] },
  ]},
  { name: 'Pull B', exercises: [
    { name: 'Lat Pulldown (Cable)', sets: [[8, 10], [8, 10], [8, 10], [8, 10]] },
    { name: 'Single Arm Row (Dumbbell)', sets: [[8, 10], [8, 10], [8, 10]] },
    { name: 'Shrug (Barbell)', sets: [[8, 12], [8, 12], [8, 12]] },
    { name: 'Rear Delt Fly (Cable)', sets: [[12, 15], [12, 15], [12, 15]] },
    { name: 'Hammer Curl (Dumbbell)', sets: [[10, 12], [10, 12], [10, 12]] },
    { name: "Farmer's Carry", sets: [[1, 1], [1, 1]], note: '30-40 seconds per carry' },
  ]},
  { name: 'Legs A', exercises: [
    { name: 'Squat (Barbell)', sets: [[5, 7], [5, 7], [5, 7], [5, 7]] },
    { name: 'Leg Press (Machine)', sets: [[8, 10], [8, 10], [8, 10]] },
    { name: 'Leg Extension (Machine)', sets: [[10, 12], [10, 12], [10, 12]] },
    { name: 'Standing Calf Raise (Machine)', sets: [[12, 15], [12, 15], [12, 15], [12, 15]] },
    { name: 'Hanging Leg Raise', sets: [[10, 15], [10, 15], [10, 15]] },
  ]},
  { name: 'Legs B', exercises: [
    { name: 'Romanian Deadlift (Barbell)', sets: [[6, 8], [6, 8], [6, 8], [6, 8]] },
    { name: 'Hack Squat (Machine)', sets: [[8, 10], [8, 10], [8, 10]] },
    { name: 'Lying Leg Curl (Machine)', sets: [[10, 12], [10, 12], [10, 12]] },
    { name: 'Seated Calf Raise (Machine)', sets: [[12, 15], [12, 15], [12, 15], [12, 15]] },
    { name: 'Crunch (Cable)', sets: [[12, 15], [12, 15], [12, 15]] },
  ]},
];

/** Seed the six PPL routines once, into a "PPL" folder. */
export async function seedRoutines(db: SqlDriver): Promise<void> {
  const done = await db.get<{ value: string }>(`SELECT value FROM setting WHERE key = 'seed_routines_done'`);
  if (done) return;
  const now = Date.now();
  await db.transaction(async () => {
    const folder = await db.run(`INSERT INTO routine_folder (name, position) VALUES ('PPL', 0)`);
    let rPos = 0;
    for (const r of PPL) {
      const routine = await db.run(
        `INSERT INTO routine (folder_id, name, notes, position, created_at) VALUES (?, ?, '', ?, ?)`,
        [folder.lastInsertRowId, r.name, rPos++, now],
      );
      let ePos = 0;
      for (const e of r.exercises) {
        const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = ?`, [e.name]);
        if (!ex) continue;
        const re = await db.run(
          `INSERT INTO routine_exercise (routine_id, exercise_id, position, notes) VALUES (?, ?, ?, ?)`,
          [routine.lastInsertRowId, ex.id, ePos++, e.note ?? ''],
        );
        let sPos = 0;
        for (const [mn, mx] of e.sets) {
          await db.run(
            `INSERT INTO routine_set (routine_exercise_id, position, target_reps_min, target_reps_max) VALUES (?, ?, ?, ?)`,
            [re.lastInsertRowId, sPos++, mn, mx],
          );
        }
      }
    }
    await db.run(`INSERT INTO setting (key, value) VALUES ('seed_routines_done', '1')`);
  });
}
