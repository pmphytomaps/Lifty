/**
 * Versioned migrations. Never edit a shipped entry — append a new one.
 * Applied inside a transaction; PRAGMA user_version tracks progress.
 */
export const SCHEMA_VERSION = 1;

export const MIGRATIONS: string[][] = [
  // v1
  [
    `CREATE TABLE exercise (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      equipment TEXT NOT NULL DEFAULT 'other',
      primary_muscle TEXT NOT NULL,
      secondary_muscles TEXT NOT NULL DEFAULT '[]',
      category TEXT NOT NULL DEFAULT 'strength',
      met REAL,
      is_custom INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE routine_folder (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE routine (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER REFERENCES routine_folder(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      archived_at INTEGER
    )`,
    `CREATE TABLE routine_exercise (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id INTEGER NOT NULL REFERENCES routine(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercise(id),
      position INTEGER NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      rest_seconds INTEGER
    )`,
    `CREATE TABLE routine_set (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_exercise_id INTEGER NOT NULL REFERENCES routine_exercise(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      target_reps_min INTEGER,
      target_reps_max INTEGER,
      target_weight_kg REAL,
      target_duration_s INTEGER
    )`,
    `CREATE TABLE workout (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id INTEGER REFERENCES routine(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      duration_s INTEGER,
      notes TEXT NOT NULL DEFAULT '',
      total_volume_kg REAL NOT NULL DEFAULT 0,
      total_sets INTEGER NOT NULL DEFAULT 0,
      pr_count INTEGER NOT NULL DEFAULT 0,
      calories_kcal REAL NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE workout_exercise (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL REFERENCES workout(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercise(id),
      position INTEGER NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      rest_seconds INTEGER
    )`,
    `CREATE TABLE workout_set (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercise(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      weight_kg REAL,
      reps INTEGER,
      duration_s INTEGER,
      is_completed INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER
    )`,
    `CREATE TABLE personal_record (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id TEXT NOT NULL REFERENCES exercise(id),
      workout_set_id INTEGER REFERENCES workout_set(id) ON DELETE CASCADE,
      workout_id INTEGER REFERENCES workout(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      value REAL NOT NULL,
      achieved_at INTEGER NOT NULL
    )`,
    `CREATE TABLE setting (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    `CREATE INDEX idx_workout_started ON workout(started_at DESC)`,
    `CREATE INDEX idx_we_workout ON workout_exercise(workout_id)`,
    `CREATE INDEX idx_we_exercise ON workout_exercise(exercise_id)`,
    `CREATE INDEX idx_ws_we ON workout_set(workout_exercise_id)`,
    `CREATE INDEX idx_pr_ex_kind ON personal_record(exercise_id, kind)`,
    `CREATE INDEX idx_pr_workout ON personal_record(workout_id)`,
  ],
];
