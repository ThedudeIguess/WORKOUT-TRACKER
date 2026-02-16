import {
  HYBRID_PHASE_1_ID,
  placeholderDayTemplate,
} from '../constants/programTemplates';
import {
  type ActiveWorkoutSummary,
  type BodyweightEntry,
  type DayTemplateWithSlots,
  type EffortLabel,
  type Exercise,
  type ExerciseMuscleMapping,
  type ExportPayload,
  type LoggedSet,
  type MuscleRole,
  type ProgressionExposure,
  type SetForVolume,
  type StrengthTrendPoint,
  type WorkoutDetail,
  type WorkoutDetailSet,
  type Workout,
  type WorkoutHistoryItem,
} from '../types';
import { runMigrations, getDatabase } from './schema';
import { seedDatabaseIfNeeded } from './seed';

const APP_SETTING_FIRST_WORKOUT_ANCHOR = 'first_workout_timestamp';
const APP_SETTING_THEME = 'theme';
const APP_SETTING_DEFAULT_REST_SECONDS = 'default_rest_seconds';
const APP_SETTING_UNITS = 'units';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface DayTemplateRow {
  id: number;
  phase_id: string;
  day_number: number;
  day_name: string;
}

interface DayTemplateSlotRow {
  id: number;
  day_template_id: number;
  slot_order: number;
  default_exercise_id: string;
  default_exercise_name: string;
  input_mode: 'reps' | 'timed';
  target_sets: number;
  target_rep_low: number;
  target_rep_high: number;
  rest_seconds: number | null;
  notes: string | null;
}

interface AlternateExerciseRow {
  exercise_id: string;
  exercise_name: string;
}

interface SetAndMappingRow {
  set_id: number;
  exercise_id: string;
  exercise_name: string;
  category: 'compound' | 'isolation' | 'metcon' | 'mobility';
  reps: number;
  load_kg: number;
  effort_label: EffortLabel;
  is_warmup: number;
  logged_at: string;
  muscle_group: string | null;
  role: MuscleRole | null;
}

interface WorkoutHistoryRow {
  workout_id: string;
  day_name: string;
  day_number: number;
  started_at: string;
  completed_at: string;
  prs_score: number | null;
  duration_minutes: number;
  total_sets: number;
}

interface StrengthSetRow {
  workout_id: string;
  exercise_id: string;
  exercise_name: string;
  completed_at: string;
  reps: number;
  load_kg: number;
}

interface ActiveWorkoutRow {
  workout_id: string;
  day_template_id: number;
  day_number: number;
  day_name: string;
  started_at: string;
}

interface ExposureWorkoutRow {
  workout_id: string;
  completed_at: string;
}

interface WorkoutSetRow {
  reps: number;
  load_kg: number;
}

interface AppSettingRow {
  value: string;
}

interface WeekStatsRow {
  workouts_this_week: number;
  sets_this_week: number;
}

interface AdherenceWorkoutRow {
  workout_id: string;
  started_at: string;
}

interface AnchorRow {
  anchor: string;
}

interface ExerciseOptionRow {
  id: string;
  name: string;
}

interface ExerciseLibraryRow {
  id: string;
  name: string;
  category: Exercise['category'];
  equipment: Exercise['equipment'];
  is_active: number;
}

interface WorkoutDetailRow {
  workout_id: string;
  day_name: string | null;
  day_number: number | null;
  started_at: string;
  completed_at: string | null;
  prs_score: number | null;
  bodyweight_kg: number | null;
  notes: string | null;
}

interface WorkoutDetailSetRow {
  id: number;
  workout_id: string;
  exercise_id: string;
  exercise_name: string | null;
  exercise_category: Exercise['category'] | null;
  set_order: number;
  reps: number;
  load_kg: number;
  effort_label: EffortLabel;
  is_warmup: number;
  logged_at: string;
  notes: string | null;
}

interface ExportSetRow extends Omit<LoggedSet, 'isWarmup'> {
  isWarmup: number;
}

interface ExportExerciseRow extends Omit<Exercise, 'isActive'> {
  isActive: number;
}

interface ImportSummary {
  workouts: number;
  sets: number;
  bodyweightEntries: number;
}

function wrapDatabaseError(operation: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`${operation} failed: ${error.message}`);
  }

  return new Error(`${operation} failed: Unknown database error`);
}

async function withDatabase<T>(
  operation: string,
  action: Awaited<ReturnType<typeof getDatabase>> extends never
    ? never
    : (database: Awaited<ReturnType<typeof getDatabase>>) => Promise<T>
): Promise<T> {
  try {
    const database = await getDatabase();
    return await action(database);
  } catch (error) {
    throw wrapDatabaseError(operation, error);
  }
}

function generateWorkoutId(): string {
  const maybeCrypto = globalThis.crypto as
    | {
        randomUUID?: () => string;
      }
    | undefined;
  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
    return maybeCrypto.randomUUID();
  }

  return `workout-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export async function initializeDatabase(): Promise<void> {
  await withDatabase('initializeDatabase', async () => {
    await runMigrations();
    await seedDatabaseIfNeeded();

    const defaults: Array<[string, string]> = [
      [APP_SETTING_THEME, 'dark'],
      [APP_SETTING_DEFAULT_REST_SECONDS, '90'],
      [APP_SETTING_UNITS, 'kg'],
    ];

    for (const [key, value] of defaults) {
      await setAppSetting(key, value, true);
    }
  });
}

export async function getAppSetting(key: string): Promise<string | null> {
  return withDatabase('getAppSetting', async (database) => {
    const row = await database.getFirstAsync<AppSettingRow>(
      'SELECT value FROM app_settings WHERE key = ?;',
      [key]
    );
    return row?.value ?? null;
  });
}

export async function setAppSetting(
  key: string,
  value: string,
  preserveExisting = false
): Promise<void> {
  await withDatabase('setAppSetting', async (database) => {
    if (preserveExisting) {
      await database.runAsync(
        `INSERT INTO app_settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO NOTHING;`,
        [key, value]
      );
      return;
    }

    await database.runAsync(
      `INSERT INTO app_settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      [key, value]
    );
  });
}

export async function createWorkoutSession(input: {
  dayTemplateId: number;
  phaseId?: string;
  prsScore: number | null;
  bodyweightKg: number | null;
  startedAtOverride?: string;
}): Promise<{ workoutId: string }> {
  return withDatabase('createWorkoutSession', async (database) => {
    const workoutId = generateWorkoutId();
    const startedAt = input.startedAtOverride ?? new Date().toISOString();
    const phaseId = input.phaseId ?? HYBRID_PHASE_1_ID;

    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `INSERT INTO workouts (
          id,
          phase_id,
          day_template_id,
          started_at,
          prs_score,
          bodyweight_kg
        ) VALUES (?, ?, ?, ?, ?, ?);`,
        [
          workoutId,
          phaseId,
          input.dayTemplateId,
          startedAt,
          input.prsScore,
          input.bodyweightKg,
        ]
      );

      if (input.bodyweightKg !== null && Number.isFinite(input.bodyweightKg)) {
        await transaction.runAsync(
          `INSERT INTO bodyweight_log (workout_id, weight_kg, logged_at, source)
           VALUES (?, ?, ?, 'workout');`,
          [workoutId, input.bodyweightKg, startedAt]
        );
      }
    });

    return { workoutId };
  });
}

export async function completeWorkoutSession(input: {
  workoutId: string;
  notes: string | null;
  completedAt?: string;
}): Promise<void> {
  await withDatabase('completeWorkoutSession', async (database) => {
    const completedAt = input.completedAt ?? new Date().toISOString();

    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `UPDATE workouts
         SET completed_at = ?, notes = ?
         WHERE id = ?;`,
        [completedAt, input.notes, input.workoutId]
      );

      const earliestStartedCompletedWorkout = await transaction.getFirstAsync<AnchorRow>(
        `SELECT started_at AS anchor
         FROM workouts
         WHERE completed_at IS NOT NULL
         ORDER BY started_at ASC
         LIMIT 1;`
      );

      if (earliestStartedCompletedWorkout?.anchor) {
        await transaction.runAsync(
          `INSERT INTO app_settings (key, value)
           VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
          [APP_SETTING_FIRST_WORKOUT_ANCHOR, earliestStartedCompletedWorkout.anchor]
        );
      } else {
        await transaction.runAsync('DELETE FROM app_settings WHERE key = ?;', [
          APP_SETTING_FIRST_WORKOUT_ANCHOR,
        ]);
      }
    });
  });
}

export async function logSet(input: {
  workoutId: string;
  exerciseId: string;
  reps: number;
  loadKg: number;
  effortLabel: EffortLabel;
  isWarmup: boolean;
  notes: string | null;
  loggedAtOverride?: string;
}): Promise<{ setId: number }> {
  return withDatabase('logSet', async (database) => {
    const setOrderRow = await database.getFirstAsync<{ next_order: number }>(
      `SELECT COALESCE(MAX(set_order), 0) + 1 AS next_order
       FROM sets
       WHERE workout_id = ? AND exercise_id = ?;`,
      [input.workoutId, input.exerciseId]
    );

    const setOrder = setOrderRow?.next_order ?? 1;
    const nowIso = input.loggedAtOverride ?? new Date().toISOString();

    const result = await database.runAsync(
      `INSERT INTO sets (
        workout_id,
        exercise_id,
        set_order,
        reps,
        load_kg,
        effort_label,
        is_warmup,
        logged_at,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        input.workoutId,
        input.exerciseId,
        setOrder,
        input.reps,
        input.loadKg,
        input.effortLabel,
        input.isWarmup ? 1 : 0,
        nowIso,
        input.notes,
      ]
    );

    return { setId: result.lastInsertRowId };
  });
}

export async function getWorkoutSets(workoutId: string): Promise<LoggedSet[]> {
  return withDatabase('getWorkoutSets', async (database) => {
    const rows = await database.getAllAsync<
      Omit<LoggedSet, 'isWarmup'> & {
        isWarmup: number;
      }
    >(
      `SELECT
        id,
        workout_id AS workoutId,
        exercise_id AS exerciseId,
        set_order AS setOrder,
        reps,
        load_kg AS loadKg,
        effort_label AS effortLabel,
        is_warmup AS isWarmup,
        logged_at AS loggedAt,
        notes
      FROM sets
      WHERE workout_id = ?
      ORDER BY logged_at ASC, set_order ASC;`,
      [workoutId]
    );

    return rows.map((row) => ({
      ...row,
      isWarmup: row.isWarmup === 1,
    }));
  });
}

export async function deleteSet(setId: number): Promise<void> {
  await withDatabase('deleteSet', async (database) => {
    await database.runAsync('DELETE FROM sets WHERE id = ?;', [setId]);
  });
}

export async function updateSet(input: {
  setId: number;
  reps: number;
  loadKg: number;
  effortLabel: EffortLabel;
  isWarmup: boolean;
  notes: string | null;
}): Promise<void> {
  await withDatabase('updateSet', async (database) => {
    await database.runAsync(
      `UPDATE sets
       SET reps = ?, load_kg = ?, effort_label = ?, is_warmup = ?, notes = ?
       WHERE id = ?;`,
      [
        input.reps,
        input.loadKg,
        input.effortLabel,
        input.isWarmup ? 1 : 0,
        input.notes,
        input.setId,
      ]
    );
  });
}

export async function getSetsByDateRange(
  startIso: string,
  endIso: string
): Promise<SetForVolume[]> {
  return withDatabase('getSetsByDateRange', async (database) => {
    const rows = await database.getAllAsync<SetAndMappingRow>(
      `SELECT
        s.id AS set_id,
        s.exercise_id,
        e.name AS exercise_name,
        e.category,
        s.reps,
        s.load_kg,
        s.effort_label,
        s.is_warmup,
        s.logged_at,
        emm.muscle_group,
        emm.role
      FROM sets s
      JOIN workouts w ON w.id = s.workout_id
      JOIN exercises e ON e.id = s.exercise_id
      LEFT JOIN exercise_muscle_mappings emm ON emm.exercise_id = s.exercise_id
      WHERE s.logged_at >= ?
        AND s.logged_at < ?
        AND w.completed_at IS NOT NULL
      ORDER BY s.logged_at ASC, s.id ASC;`,
      [startIso, endIso]
    );

    const merged = new Map<number, SetForVolume>();

    for (const row of rows) {
      if (!merged.has(row.set_id)) {
        merged.set(row.set_id, {
          setId: row.set_id,
          exerciseId: row.exercise_id,
          exerciseName: row.exercise_name,
          category: row.category,
          reps: row.reps,
          loadKg: row.load_kg,
          effortLabel: row.effort_label,
          isWarmup: row.is_warmup === 1,
          loggedAt: row.logged_at,
          mappings: [],
        });
      }

      if (row.muscle_group && row.role) {
        merged.get(row.set_id)?.mappings.push({
          muscleGroup: row.muscle_group,
          role: row.role,
        });
      }
    }

    return Array.from(merged.values());
  });
}

export async function getMostRecentLoad(
  exerciseId: string
): Promise<number | null> {
  return withDatabase('getMostRecentLoad', async (database) => {
    const row = await database.getFirstAsync<{ load_kg: number }>(
      `SELECT load_kg
       FROM sets
       WHERE exercise_id = ? AND is_warmup = 0
       ORDER BY logged_at DESC
       LIMIT 1;`,
      [exerciseId]
    );

    return row?.load_kg ?? null;
  });
}

async function getDayTemplateSlots(
  dayTemplateId: number
): Promise<DayTemplateWithSlots['slots']> {
  const database = await getDatabase();

  const rows = await database.getAllAsync<DayTemplateSlotRow>(
    `SELECT
      tes.id,
      tes.day_template_id,
      tes.slot_order,
      tes.default_exercise_id,
      e.name AS default_exercise_name,
      tes.input_mode,
      tes.target_sets,
      tes.target_rep_low,
      tes.target_rep_high,
      tes.rest_seconds,
      tes.notes
    FROM template_exercise_slots tes
    JOIN exercises e ON e.id = tes.default_exercise_id
    WHERE tes.day_template_id = ?
    ORDER BY tes.slot_order ASC;`,
    [dayTemplateId]
  );

  const slots = await Promise.all(
    rows.map(async (row) => {
      const alternateRows = await database.getAllAsync<AlternateExerciseRow>(
        `SELECT sae.exercise_id, e.name AS exercise_name
         FROM slot_alternate_exercises sae
         JOIN exercises e ON e.id = sae.exercise_id
         WHERE sae.slot_id = ?
         ORDER BY e.name ASC;`,
        [row.id]
      );

      return {
        id: row.id,
        dayTemplateId: row.day_template_id,
        slotOrder: row.slot_order,
        defaultExerciseId: row.default_exercise_id,
        defaultExerciseName: row.default_exercise_name,
        inputMode: row.input_mode,
        targetSets: row.target_sets,
        targetRepLow: row.target_rep_low,
        targetRepHigh: row.target_rep_high,
        restSeconds: row.rest_seconds ?? 90,
        notes: row.notes,
        alternateExercises: alternateRows.map((alternateRow) => ({
          id: alternateRow.exercise_id,
          name: alternateRow.exercise_name,
        })),
      };
    })
  );

  return slots;
}

async function getDayTemplateByDayNumberInternal(
  dayNumber: number
): Promise<DayTemplateWithSlots | null> {
  const database = await getDatabase();

  const row = await database.getFirstAsync<DayTemplateRow>(
    `SELECT id, phase_id, day_number, day_name
     FROM day_templates
     WHERE phase_id = ? AND day_number = ?;`,
    [HYBRID_PHASE_1_ID, dayNumber]
  );

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    phaseId: row.phase_id,
    dayNumber: row.day_number,
    dayName: row.day_name,
    slots: await getDayTemplateSlots(row.id),
  };
}

export async function getDayTemplateByDayNumber(
  dayNumber: number
): Promise<DayTemplateWithSlots> {
  return withDatabase('getDayTemplateByDayNumber', async () => {
    const template = await getDayTemplateByDayNumberInternal(dayNumber);
    return template ?? placeholderDayTemplate;
  });
}

export async function getDayTemplateById(
  dayTemplateId: number
): Promise<DayTemplateWithSlots | null> {
  return withDatabase('getDayTemplateById', async (database) => {
    const row = await database.getFirstAsync<DayTemplateRow>(
      `SELECT id, phase_id, day_number, day_name
       FROM day_templates
       WHERE id = ?;`,
      [dayTemplateId]
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      phaseId: row.phase_id,
      dayNumber: row.day_number,
      dayName: row.day_name,
      slots: await getDayTemplateSlots(row.id),
    };
  });
}

export async function listProgramDayTemplates(
  phaseId = HYBRID_PHASE_1_ID
): Promise<DayTemplateWithSlots[]> {
  return withDatabase('listProgramDayTemplates', async (database) => {
    const rows = await database.getAllAsync<DayTemplateRow>(
      `SELECT id, phase_id, day_number, day_name
       FROM day_templates
       WHERE phase_id = ?
       ORDER BY day_number ASC;`,
      [phaseId]
    );

    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        phaseId: row.phase_id,
        dayNumber: row.day_number,
        dayName: row.day_name,
        slots: await getDayTemplateSlots(row.id),
      }))
    );
  });
}

export async function updateDayTemplateName(input: {
  dayTemplateId: number;
  dayName: string;
}): Promise<void> {
  await withDatabase('updateDayTemplateName', async (database) => {
    await database.runAsync(
      `UPDATE day_templates
       SET day_name = ?
       WHERE id = ?;`,
      [input.dayName, input.dayTemplateId]
    );
  });
}

export async function updateTemplateExerciseSlot(input: {
  slotId: number;
  targetSets: number;
  targetRepLow: number;
  targetRepHigh: number;
  restSeconds: number;
  notes: string | null;
}): Promise<void> {
  await withDatabase('updateTemplateExerciseSlot', async (database) => {
    await database.runAsync(
      `UPDATE template_exercise_slots
       SET target_sets = ?,
           target_rep_low = ?,
           target_rep_high = ?,
           rest_seconds = ?,
           notes = ?
       WHERE id = ?;`,
      [
        input.targetSets,
        input.targetRepLow,
        input.targetRepHigh,
        input.restSeconds,
        input.notes,
        input.slotId,
      ]
    );
  });
}

export async function getActiveWorkout(): Promise<ActiveWorkoutSummary | null> {
  return withDatabase('getActiveWorkout', async (database) => {
    const row = await database.getFirstAsync<ActiveWorkoutRow>(
      `SELECT
        w.id AS workout_id,
        w.day_template_id,
        dt.day_number,
        dt.day_name,
        w.started_at
      FROM workouts w
      JOIN day_templates dt ON dt.id = w.day_template_id
      WHERE w.completed_at IS NULL
      ORDER BY w.started_at DESC
      LIMIT 1;`
    );

    if (!row) {
      return null;
    }

    return {
      workoutId: row.workout_id,
      dayTemplateId: row.day_template_id,
      dayNumber: row.day_number,
      dayName: row.day_name,
      startedAt: row.started_at,
    };
  });
}

export async function getNextDayTemplate(): Promise<DayTemplateWithSlots> {
  return withDatabase('getNextDayTemplate', async (database) => {
    const totalDaysRow = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM day_templates
       WHERE phase_id = ?;`,
      [HYBRID_PHASE_1_ID]
    );

    const totalDays = totalDaysRow?.count ?? 0;
    if (totalDays === 0) {
      return placeholderDayTemplate;
    }

    const latestCompleted = await database.getFirstAsync<{ day_number: number }>(
      `SELECT dt.day_number
       FROM workouts w
       JOIN day_templates dt ON dt.id = w.day_template_id
       WHERE w.completed_at IS NOT NULL
       ORDER BY w.completed_at DESC
       LIMIT 1;`
    );

    const nextDayNumber = latestCompleted
      ? (latestCompleted.day_number % totalDays) + 1
      : 1;

    const template = await getDayTemplateByDayNumberInternal(nextDayNumber);
    return template ?? placeholderDayTemplate;
  });
}

export async function getWorkoutHistory(
  limit = 50
): Promise<WorkoutHistoryItem[]> {
  return withDatabase('getWorkoutHistory', async (database) => {
    const rows = await database.getAllAsync<WorkoutHistoryRow>(
      `SELECT
        w.id AS workout_id,
        dt.day_name,
        dt.day_number,
        w.started_at,
        w.completed_at,
        w.prs_score,
        CAST((julianday(w.completed_at) - julianday(w.started_at)) * 24 * 60 AS INTEGER) AS duration_minutes,
        COALESCE(COUNT(s.id), 0) AS total_sets
      FROM workouts w
      JOIN day_templates dt ON dt.id = w.day_template_id
      LEFT JOIN sets s ON s.workout_id = w.id
      WHERE w.completed_at IS NOT NULL
      GROUP BY w.id
      ORDER BY w.completed_at DESC
      LIMIT ?;`,
      [limit]
    );

    return rows.map((row) => ({
      workoutId: row.workout_id,
      dayName: row.day_name,
      dayNumber: row.day_number,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      prsScore: row.prs_score,
      durationMinutes: Math.max(0, row.duration_minutes ?? 0),
      totalSets: row.total_sets,
    }));
  });
}

export async function getWorkoutExerciseSummaries(
  workoutIds: string[]
): Promise<Record<string, string[]>> {
  if (workoutIds.length === 0) return {};
  return withDatabase('getWorkoutExerciseSummaries', async (database) => {
    const placeholders = workoutIds.map(() => '?').join(',');
    const rows = await database.getAllAsync<{
      workout_id: string;
      exercise_name: string;
      top_load: number;
    }>(
      `SELECT
        s.workout_id,
        e.name AS exercise_name,
        MAX(s.load_kg) AS top_load
      FROM sets s
      JOIN exercises e ON e.id = s.exercise_id
      WHERE s.workout_id IN (${placeholders})
        AND s.is_warmup = 0
      GROUP BY s.workout_id, s.exercise_id
      ORDER BY s.workout_id, MIN(s.logged_at) ASC;`,
      workoutIds
    );

    const result: Record<string, string[]> = {};
    for (const row of rows) {
      if (!result[row.workout_id]) {
        result[row.workout_id] = [];
      }
      result[row.workout_id].push(`${row.exercise_name} ${row.top_load}kg`);
    }
    return result;
  });
}

export async function getWorkoutDetail(
  workoutId: string
): Promise<WorkoutDetail | null> {
  return withDatabase('getWorkoutDetail', async (database) => {
    const workoutRow = await database.getFirstAsync<WorkoutDetailRow>(
      `SELECT
        w.id AS workout_id,
        dt.day_name,
        dt.day_number,
        w.started_at,
        w.completed_at,
        w.prs_score,
        w.bodyweight_kg,
        w.notes
      FROM workouts w
      LEFT JOIN day_templates dt ON dt.id = w.day_template_id
      WHERE w.id = ?
      LIMIT 1;`,
      [workoutId]
    );

    if (!workoutRow) {
      return null;
    }

    const setRows = await database.getAllAsync<WorkoutDetailSetRow>(
      `SELECT
        s.id,
        s.workout_id,
        s.exercise_id,
        e.name AS exercise_name,
        e.category AS exercise_category,
        s.set_order,
        s.reps,
        s.load_kg,
        s.effort_label,
        s.is_warmup,
        s.logged_at,
        s.notes
      FROM sets s
      LEFT JOIN exercises e ON e.id = s.exercise_id
      WHERE s.workout_id = ?
      ORDER BY s.logged_at ASC, s.id ASC, s.set_order ASC;`,
      [workoutId]
    );

    const sets: WorkoutDetailSet[] = setRows.map((row) => ({
      id: row.id,
      workoutId: row.workout_id,
      exerciseId: row.exercise_id,
      exerciseName: row.exercise_name ?? row.exercise_id,
      exerciseCategory: row.exercise_category ?? 'compound',
      setOrder: row.set_order,
      reps: row.reps,
      loadKg: row.load_kg,
      effortLabel: row.effort_label,
      isWarmup: row.is_warmup === 1,
      loggedAt: row.logged_at,
      notes: row.notes,
    }));

    const completedAtIso = workoutRow.completed_at;
    const durationMinutes = Math.max(
      0,
      Math.floor(
        (new Date(completedAtIso ?? workoutRow.started_at).getTime() -
          new Date(workoutRow.started_at).getTime()) /
          (60 * 1000)
      )
    );

    return {
      workoutId: workoutRow.workout_id,
      dayName: workoutRow.day_name ?? 'Workout',
      dayNumber: workoutRow.day_number ?? 1,
      startedAt: workoutRow.started_at,
      completedAt: workoutRow.completed_at,
      prsScore: workoutRow.prs_score,
      bodyweightKg: workoutRow.bodyweight_kg,
      notes: workoutRow.notes,
      durationMinutes,
      totalSets: sets.length,
      sets,
    };
  });
}

export async function getWeekStats(
  startIso: string,
  endIso: string
): Promise<{ workoutsThisWeek: number; setsThisWeek: number }> {
  return withDatabase('getWeekStats', async (database) => {
    const row = await database.getFirstAsync<WeekStatsRow>(
      `SELECT
        COALESCE(COUNT(DISTINCT w.id), 0) AS workouts_this_week,
        COALESCE(COUNT(s.id), 0) AS sets_this_week
      FROM workouts w
      LEFT JOIN sets s ON s.workout_id = w.id
      WHERE w.completed_at IS NOT NULL
        AND w.completed_at >= ?
        AND w.completed_at < ?;`,
      [startIso, endIso]
    );

    return {
      workoutsThisWeek: row?.workouts_this_week ?? 0,
      setsThisWeek: row?.sets_this_week ?? 0,
    };
  });
}

export async function getAdherenceStats(
  windowStartIso: string,
  windowEndIso: string,
  plannedPerWeek: number
): Promise<{
  completed: number;
  planned: number;
  percentage: number;
  weeklyBreakdown: { weekStartIso: string; count: number }[];
}> {
  return withDatabase('getAdherenceStats', async (database) => {
    const windowStartMs = new Date(windowStartIso).getTime();
    const windowEndMs = new Date(windowEndIso).getTime();

    if (!Number.isFinite(windowStartMs) || !Number.isFinite(windowEndMs)) {
      throw new Error('Invalid adherence window dates.');
    }

    if (windowEndMs <= windowStartMs) {
      throw new Error('Adherence window end must be after start.');
    }

    const workouts = await database.getAllAsync<AdherenceWorkoutRow>(
      `SELECT DISTINCT
        w.id AS workout_id,
        w.started_at
      FROM workouts w
      WHERE w.completed_at IS NOT NULL
        AND w.started_at >= ?
        AND w.started_at < ?
      ORDER BY w.started_at ASC;`,
      [windowStartIso, windowEndIso]
    );

    const totalWeeks = Math.max(
      1,
      Math.ceil((windowEndMs - windowStartMs) / ONE_WEEK_MS)
    );
    const safePlannedPerWeek = Math.max(0, Math.floor(plannedPerWeek));
    const weeklyBreakdown = Array.from({ length: totalWeeks }, (_, index) => ({
      weekStartIso: new Date(windowStartMs + index * ONE_WEEK_MS).toISOString(),
      count: 0,
    }));

    for (const workout of workouts) {
      const startedAtMs = new Date(workout.started_at).getTime();
      if (!Number.isFinite(startedAtMs)) {
        continue;
      }

      const weekIndex = Math.floor((startedAtMs - windowStartMs) / ONE_WEEK_MS);
      if (weekIndex < 0 || weekIndex >= weeklyBreakdown.length) {
        continue;
      }

      weeklyBreakdown[weekIndex].count += 1;
    }

    const completed = workouts.length;
    const planned = safePlannedPerWeek * totalWeeks;
    const percentage = planned > 0 ? (completed / planned) * 100 : 0;

    return {
      completed,
      planned,
      percentage,
      weeklyBreakdown,
    };
  });
}

export async function getRecentExerciseExposures(
  exerciseId: string,
  limit = 2
): Promise<ProgressionExposure[]> {
  return withDatabase('getRecentExerciseExposures', async (database) => {
    const workouts = await database.getAllAsync<ExposureWorkoutRow>(
      `SELECT DISTINCT
        w.id AS workout_id,
        w.completed_at
      FROM workouts w
      JOIN sets s ON s.workout_id = w.id
      WHERE s.exercise_id = ?
        AND w.completed_at IS NOT NULL
      ORDER BY w.completed_at DESC
      LIMIT ?;`,
      [exerciseId, limit]
    );

    const exposures: ProgressionExposure[] = [];

    for (const workout of workouts) {
      const targetRow = await database.getFirstAsync<{ target_rep_high: number }>(
        `SELECT tes.target_rep_high
         FROM workouts w
         JOIN template_exercise_slots tes ON tes.day_template_id = w.day_template_id
         LEFT JOIN slot_alternate_exercises sae
           ON sae.slot_id = tes.id
           AND sae.exercise_id = ?
         WHERE w.id = ?
           AND (
             tes.default_exercise_id = ?
             OR sae.exercise_id IS NOT NULL
           )
         ORDER BY tes.slot_order ASC
         LIMIT 1;`,
        [exerciseId, workout.workout_id, exerciseId]
      );

      const workingSets = await database.getAllAsync<WorkoutSetRow>(
        `SELECT reps, load_kg
         FROM sets
         WHERE workout_id = ?
           AND exercise_id = ?
           AND is_warmup = 0
         ORDER BY set_order ASC;`,
        [workout.workout_id, exerciseId]
      );

      exposures.push({
        workoutId: workout.workout_id,
        completedAt: workout.completed_at,
        targetRepHigh: targetRow?.target_rep_high ?? 10,
        workingSetReps: workingSets.map((setRow) => setRow.reps),
        topLoadKg:
          workingSets.reduce((accumulator, setRow) =>
            Math.max(accumulator, setRow.load_kg), 0
          ) ?? 0,
      });
    }

    return exposures;
  });
}

export async function listExercises(): Promise<Array<{ id: string; name: string }>> {
  return withDatabase('listExercises', async (database) => {
    const rows = await database.getAllAsync<ExerciseOptionRow>(
      `SELECT id, name
       FROM exercises
       WHERE is_active = 1
       ORDER BY name ASC;`
    );

    return rows;
  });
}

export async function listExerciseLibrary(): Promise<Exercise[]> {
  return withDatabase('listExerciseLibrary', async (database) => {
    const rows = await database.getAllAsync<ExerciseLibraryRow>(
      `SELECT
        id,
        name,
        category,
        equipment,
        is_active
       FROM exercises
       ORDER BY name ASC;`
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      equipment: row.equipment,
      isActive: row.is_active === 1,
    }));
  });
}

export async function setExerciseActive(input: {
  exerciseId: string;
  isActive: boolean;
}): Promise<void> {
  await withDatabase('setExerciseActive', async (database) => {
    await database.runAsync(
      `UPDATE exercises
       SET is_active = ?
       WHERE id = ?;`,
      [input.isActive ? 1 : 0, input.exerciseId]
    );
  });
}

export async function insertCustomExercise(exercise: {
  id: string;
  name: string;
  category: Exercise['category'];
  equipment: Exercise['equipment'];
}): Promise<void> {
  await withDatabase('insertCustomExercise', async (database) => {
    await database.runAsync(
      `INSERT INTO exercises (id, name, category, equipment, is_active)
       VALUES (?, ?, ?, ?, 1);`,
      [exercise.id, exercise.name, exercise.category, exercise.equipment]
    );
  });
}

export async function insertExerciseMuscleMappings(mappings: {
  exerciseId: string;
  muscleGroup: string;
  role: MuscleRole;
}[]): Promise<void> {
  await withDatabase('insertExerciseMuscleMappings', async (database) => {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      for (const mapping of mappings) {
        await transaction.runAsync(
          `INSERT INTO exercise_muscle_mappings (exercise_id, muscle_group, role)
           VALUES (?, ?, ?)
           ON CONFLICT(exercise_id, muscle_group) DO UPDATE SET role = excluded.role;`,
          [mapping.exerciseId, mapping.muscleGroup, mapping.role]
        );
      }
    });
  });
}

export async function addSlotAlternate(slotId: number, exerciseId: string): Promise<void> {
  await withDatabase('addSlotAlternate', async (database) => {
    await database.runAsync(
      `INSERT OR IGNORE INTO slot_alternate_exercises (slot_id, exercise_id)
       VALUES (?, ?);`,
      [slotId, exerciseId]
    );
  });
}

export async function updateCustomExerciseDefinition(input: {
  exerciseId: string;
  name: string;
  category: Exercise['category'];
}): Promise<void> {
  if (!input.exerciseId.startsWith('custom-')) {
    throw new Error('Only custom exercises can be edited.');
  }

  await withDatabase('updateCustomExerciseDefinition', async (database) => {
    await database.runAsync(
      `UPDATE exercises
       SET name = ?, category = ?
       WHERE id = ?;`,
      [input.name, input.category, input.exerciseId]
    );
  });
}

export async function deleteCustomExercise(exerciseId: string): Promise<void> {
  if (!exerciseId.startsWith('custom-')) {
    throw new Error('Only custom exercises can be deleted.');
  }

  await withDatabase('deleteCustomExercise', async (database) => {
    const usageRow = await database.getFirstAsync<{ usage_count: number }>(
      `SELECT COUNT(*) AS usage_count
       FROM sets
       WHERE exercise_id = ?;`,
      [exerciseId]
    );

    if ((usageRow?.usage_count ?? 0) > 0) {
      throw new Error('Cannot delete a custom exercise that already has logged sets.');
    }

    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        'DELETE FROM slot_alternate_exercises WHERE exercise_id = ?;',
        [exerciseId]
      );
      await transaction.runAsync(
        'DELETE FROM exercise_muscle_mappings WHERE exercise_id = ?;',
        [exerciseId]
      );
      await transaction.runAsync('DELETE FROM exercises WHERE id = ?;', [exerciseId]);
    });
  });
}

export async function getStrengthTrendSeries(
  exerciseId: string
): Promise<StrengthTrendPoint[]> {
  return withDatabase('getStrengthTrendSeries', async (database) => {
    const rows = await database.getAllAsync<StrengthSetRow>(
      `SELECT
        w.id AS workout_id,
        s.exercise_id,
        e.name AS exercise_name,
        w.completed_at,
        s.reps,
        s.load_kg
      FROM sets s
      JOIN workouts w ON w.id = s.workout_id
      JOIN exercises e ON e.id = s.exercise_id
      WHERE s.exercise_id = ?
        AND w.completed_at IS NOT NULL
        AND s.is_warmup = 0
      ORDER BY w.completed_at ASC, s.load_kg DESC, s.reps DESC;`,
      [exerciseId]
    );

    const byWorkout = new Map<string, StrengthTrendPoint>();

    for (const row of rows) {
      const existing = byWorkout.get(row.workout_id);
      if (!existing) {
        byWorkout.set(row.workout_id, {
          workoutId: row.workout_id,
          exerciseId: row.exercise_id,
          exerciseName: row.exercise_name,
          completedAt: row.completed_at,
          bestSetReps: row.reps,
          bestSetLoadKg: row.load_kg,
        });
        continue;
      }

      const existingScore = existing.bestSetLoadKg * (1 + existing.bestSetReps / 30);
      const candidateScore = row.load_kg * (1 + row.reps / 30);
      if (candidateScore > existingScore) {
        byWorkout.set(row.workout_id, {
          ...existing,
          bestSetReps: row.reps,
          bestSetLoadKg: row.load_kg,
        });
      }
    }

    return Array.from(byWorkout.values()).sort((a, b) =>
      a.completedAt.localeCompare(b.completedAt)
    );
  });
}

export async function logBodyweight(input: {
  weightKg: number;
  loggedAt?: string;
}): Promise<void> {
  await withDatabase('logBodyweight', async (database) => {
    const loggedAt = input.loggedAt ?? new Date().toISOString();

    await database.runAsync(
      `INSERT INTO bodyweight_log (workout_id, weight_kg, logged_at, source)
       VALUES (NULL, ?, ?, 'manual');`,
      [input.weightKg, loggedAt]
    );
  });
}

export async function getBodyweightLog(
  limit = 100
): Promise<BodyweightEntry[]> {
  return withDatabase('getBodyweightLog', async (database) => {
    const rows = await database.getAllAsync<{
      id: number;
      workout_id: string | null;
      weight_kg: number;
      logged_at: string;
      source: 'workout' | 'manual';
    }>(
      `SELECT id, workout_id, weight_kg, logged_at, source
       FROM bodyweight_log
       ORDER BY logged_at DESC
       LIMIT ?;`,
      [limit]
    );

    return rows.map((row) => ({
      id: row.id,
      workoutId: row.workout_id,
      weightKg: row.weight_kg,
      loggedAt: row.logged_at,
      source: row.source,
    }));
  });
}

export async function exportAllData(): Promise<ExportPayload> {
  return withDatabase('exportAllData', async (database) => {
    const workouts = await database.getAllAsync<Workout>(
      `SELECT
        id,
        phase_id AS phaseId,
        day_template_id AS dayTemplateId,
        started_at AS startedAt,
        completed_at AS completedAt,
        prs_score AS prsScore,
        bodyweight_kg AS bodyweightKg,
        notes
      FROM workouts
      ORDER BY started_at ASC;`
    );

    const sets = await database.getAllAsync<ExportSetRow>(
      `SELECT
        id,
        workout_id AS workoutId,
        exercise_id AS exerciseId,
        set_order AS setOrder,
        reps,
        load_kg AS loadKg,
        effort_label AS effortLabel,
        is_warmup AS isWarmup,
        logged_at AS loggedAt,
        notes
      FROM sets
      ORDER BY logged_at ASC;`
    );

    const exercises = await database.getAllAsync<ExportExerciseRow>(
      `SELECT
        id,
        name,
        category,
        equipment,
        is_active AS isActive
      FROM exercises
      ORDER BY name ASC;`
    );

    const mappings = await database.getAllAsync<ExerciseMuscleMapping>(
      `SELECT
        exercise_id AS exerciseId,
        muscle_group AS muscleGroup,
        role
      FROM exercise_muscle_mappings
      ORDER BY exercise_id ASC;`
    );

    const bodyweightLog = await getBodyweightLog(10000);

    return {
      exportedAt: new Date().toISOString(),
      workouts,
      sets: sets.map((setRow) => ({
        ...setRow,
        isWarmup: setRow.isWarmup === 1,
      })),
      exercises: exercises.map((exerciseRow) => ({
        ...exerciseRow,
        isActive: exerciseRow.isActive === 1,
      })),
      exercise_muscle_mappings: mappings,
      bodyweight_log: bodyweightLog,
    };
  });
}

function assertImportPayloadShape(payload: ExportPayload): void {
  if (!Array.isArray(payload.workouts)) {
    throw new Error('Import payload is missing workouts.');
  }

  if (!Array.isArray(payload.sets)) {
    throw new Error('Import payload is missing sets.');
  }

  if (!Array.isArray(payload.exercises)) {
    throw new Error('Import payload is missing exercises.');
  }

  if (!Array.isArray(payload.exercise_muscle_mappings)) {
    throw new Error('Import payload is missing exercise_muscle_mappings.');
  }

  if (!Array.isArray(payload.bodyweight_log)) {
    throw new Error('Import payload is missing bodyweight_log.');
  }
}

export async function restoreFromExportData(
  payload: ExportPayload
): Promise<ImportSummary> {
  assertImportPayloadShape(payload);

  return withDatabase('restoreFromExportData', async (database) => {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync('DELETE FROM sets;');
      await transaction.runAsync('DELETE FROM bodyweight_log;');
      await transaction.runAsync('DELETE FROM workouts;');

      for (const exercise of payload.exercises) {
        await transaction.runAsync(
          `INSERT INTO exercises (id, name, category, equipment, is_active)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             category = excluded.category,
             equipment = excluded.equipment,
             is_active = excluded.is_active;`,
          [
            exercise.id,
            exercise.name,
            exercise.category,
            exercise.equipment,
            exercise.isActive ? 1 : 0,
          ]
        );
      }

      if (payload.exercise_muscle_mappings.length > 0) {
        await transaction.runAsync('DELETE FROM exercise_muscle_mappings;');
        for (const mapping of payload.exercise_muscle_mappings) {
          await transaction.runAsync(
            `INSERT INTO exercise_muscle_mappings (exercise_id, muscle_group, role)
             VALUES (?, ?, ?)
             ON CONFLICT(exercise_id, muscle_group) DO UPDATE SET role = excluded.role;`,
            [mapping.exerciseId, mapping.muscleGroup, mapping.role]
          );
        }
      }

      await transaction.runAsync(
        "DELETE FROM sqlite_sequence WHERE name IN ('sets', 'bodyweight_log');"
      );

      for (const workout of payload.workouts) {
        await transaction.runAsync(
          `INSERT INTO workouts (
            id,
            phase_id,
            day_template_id,
            started_at,
            completed_at,
            prs_score,
            bodyweight_kg,
            notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            workout.id,
            workout.phaseId,
            workout.dayTemplateId,
            workout.startedAt,
            workout.completedAt,
            workout.prsScore,
            workout.bodyweightKg,
            workout.notes,
          ]
        );
      }

      for (const setRow of payload.sets) {
        await transaction.runAsync(
          `INSERT INTO sets (
            id,
            workout_id,
            exercise_id,
            set_order,
            reps,
            load_kg,
            effort_label,
            is_warmup,
            logged_at,
            notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            setRow.id,
            setRow.workoutId,
            setRow.exerciseId,
            setRow.setOrder,
            setRow.reps,
            setRow.loadKg,
            setRow.effortLabel,
            setRow.isWarmup ? 1 : 0,
            setRow.loggedAt,
            setRow.notes,
          ]
        );
      }

      for (const bodyweight of payload.bodyweight_log) {
        await transaction.runAsync(
          `INSERT INTO bodyweight_log (
            id,
            workout_id,
            weight_kg,
            logged_at,
            source
          ) VALUES (?, ?, ?, ?, ?);`,
          [
            bodyweight.id,
            bodyweight.workoutId,
            bodyweight.weightKg,
            bodyweight.loggedAt,
            bodyweight.source,
          ]
        );
      }

      const earliestStartedCompletedWorkout = payload.workouts
        .filter((workout) => workout.completedAt !== null)
        .sort((left, right) =>
          (left.startedAt ?? '').localeCompare(right.startedAt ?? '')
        )[0];

      if (earliestStartedCompletedWorkout?.startedAt) {
        await transaction.runAsync(
          `INSERT INTO app_settings (key, value)
           VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
          [APP_SETTING_FIRST_WORKOUT_ANCHOR, earliestStartedCompletedWorkout.startedAt]
        );
      } else {
        await transaction.runAsync(
          'DELETE FROM app_settings WHERE key = ?;',
          [APP_SETTING_FIRST_WORKOUT_ANCHOR]
        );
      }
    });

    return {
      workouts: payload.workouts.length,
      sets: payload.sets.length,
      bodyweightEntries: payload.bodyweight_log.length,
    };
  });
}

export async function getFirstWorkoutAnchor(): Promise<string | null> {
  return withDatabase('getFirstWorkoutAnchor', async (database) => {
    const persisted = await database.getFirstAsync<AppSettingRow>(
      'SELECT value FROM app_settings WHERE key = ?;',
      [APP_SETTING_FIRST_WORKOUT_ANCHOR]
    );

    const inferred = await database.getFirstAsync<AnchorRow>(
      `SELECT started_at AS anchor
       FROM workouts
       WHERE completed_at IS NOT NULL
       ORDER BY started_at ASC
       LIMIT 1;`
    );

    if (!inferred?.anchor) {
      if (persisted?.value) {
        await database.runAsync('DELETE FROM app_settings WHERE key = ?;', [
          APP_SETTING_FIRST_WORKOUT_ANCHOR,
        ]);
      }
      return null;
    }

    if (persisted?.value !== inferred.anchor) {
      await database.runAsync(
        `INSERT INTO app_settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
        [APP_SETTING_FIRST_WORKOUT_ANCHOR, inferred.anchor]
      );
    }

    return inferred.anchor;
  });
}
