import {
  type SQLiteDatabase,
  openDatabaseAsync,
} from 'expo-sqlite';

const DATABASE_NAME = 'workout-tracker.db';
const SCHEMA_VERSION_KEY = 'schema_version';

interface Migration {
  version: number;
  statements: string[];
}

let databasePromise: Promise<SQLiteDatabase> | null = null;

const migrations: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        equipment TEXT,
        is_active INTEGER NOT NULL DEFAULT 1
      );`,
      `CREATE TABLE IF NOT EXISTS exercise_muscle_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        muscle_group TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('direct', 'indirect')),
        UNIQUE(exercise_id, muscle_group)
      );`,
      `CREATE TABLE IF NOT EXISTS muscle_groups (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        size_category TEXT NOT NULL CHECK(size_category IN ('large', 'small')),
        mev_low REAL NOT NULL,
        mev_high REAL NOT NULL,
        optimal_low REAL NOT NULL,
        optimal_high REAL NOT NULL,
        mrv_low REAL NOT NULL,
        mrv_high REAL NOT NULL,
        evidence_grade TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS programs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      );`,
      `CREATE TABLE IF NOT EXISTS program_phases (
        id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL REFERENCES programs(id),
        name TEXT NOT NULL,
        phase_order INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      );`,
      `CREATE TABLE IF NOT EXISTS day_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phase_id TEXT NOT NULL REFERENCES program_phases(id),
        day_number INTEGER NOT NULL,
        day_name TEXT NOT NULL,
        UNIQUE(phase_id, day_number)
      );`,
      `CREATE TABLE IF NOT EXISTS template_exercise_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_template_id INTEGER NOT NULL REFERENCES day_templates(id),
        slot_order INTEGER NOT NULL,
        default_exercise_id TEXT NOT NULL REFERENCES exercises(id),
        target_sets INTEGER NOT NULL DEFAULT 2,
        target_rep_low INTEGER NOT NULL,
        target_rep_high INTEGER NOT NULL,
        rest_seconds INTEGER,
        notes TEXT,
        UNIQUE(day_template_id, slot_order)
      );`,
      `CREATE TABLE IF NOT EXISTS slot_alternate_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slot_id INTEGER NOT NULL REFERENCES template_exercise_slots(id),
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        UNIQUE(slot_id, exercise_id)
      );`,
      `CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY,
        phase_id TEXT REFERENCES program_phases(id),
        day_template_id INTEGER REFERENCES day_templates(id),
        started_at TEXT NOT NULL,
        completed_at TEXT,
        prs_score INTEGER,
        bodyweight_kg REAL,
        notes TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id TEXT NOT NULL REFERENCES workouts(id),
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        set_order INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        load_kg REAL NOT NULL,
        effort_label TEXT NOT NULL CHECK(effort_label IN ('easy', 'productive', 'hard', 'failure')),
        is_warmup INTEGER NOT NULL DEFAULT 0,
        logged_at TEXT NOT NULL,
        notes TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS bodyweight_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id TEXT REFERENCES workouts(id),
        weight_kg REAL NOT NULL,
        logged_at TEXT NOT NULL,
        source TEXT NOT NULL CHECK(source IN ('workout', 'manual'))
      );`,
      'CREATE INDEX IF NOT EXISTS idx_sets_workout_id ON sets(workout_id);',
      'CREATE INDEX IF NOT EXISTS idx_sets_exercise_id ON sets(exercise_id);',
      'CREATE INDEX IF NOT EXISTS idx_sets_logged_at ON sets(logged_at);',
      'CREATE INDEX IF NOT EXISTS idx_workouts_completed_at ON workouts(completed_at);',
      'CREATE INDEX IF NOT EXISTS idx_workouts_started_at ON workouts(started_at);',
      'CREATE INDEX IF NOT EXISTS idx_bodyweight_logged_at ON bodyweight_log(logged_at);',
    ],
  },
];

export const CURRENT_SCHEMA_VERSION = migrations[migrations.length - 1]?.version ?? 0;

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME);
  }

  const database = await databasePromise;
  await database.execAsync('PRAGMA foreign_keys = ON;');
  return database;
}

async function getSchemaVersion(database: SQLiteDatabase): Promise<number> {
  await database.runAsync(
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );`
  );

  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?;',
    [SCHEMA_VERSION_KEY]
  );

  if (!row) {
    return 0;
  }

  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function setSchemaVersion(
  database: SQLiteDatabase,
  version: number
): Promise<void> {
  await database.runAsync(
    `INSERT INTO app_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [SCHEMA_VERSION_KEY, String(version)]
  );
}

export async function runMigrations(): Promise<number> {
  const database = await getDatabase();
  const currentVersion = await getSchemaVersion(database);

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await database.withExclusiveTransactionAsync(async (transaction) => {
      for (const statement of migration.statements) {
        await transaction.execAsync(statement);
      }

      await setSchemaVersion(transaction, migration.version);
    });
  }

  return CURRENT_SCHEMA_VERSION;
}
