import { HYBRID_PHASE_1_ID } from '../constants/programTemplates';
import { type EffortLabel } from '../types';
import { getDatabase } from './schema';
import historicalSessionsJson from './historical-sessions.json';

const HISTORY_IMPORTED_KEY = 'history_imported';
const HISTORY_IMPORTED_DONE = 'done';
const FIRST_WORKOUT_TIMESTAMP_KEY = 'first_workout_timestamp';
const FIRST_WORKOUT_TIMESTAMP_VALUE = '2025-12-25T10:00:00.000Z';
const DEFAULT_WORKOUT_START_HOUR = 'T10:00:00.000Z';
const DEFAULT_WORKOUT_COMPLETE_HOUR = 'T11:00:00.000Z';

interface HistoricalSet {
  exerciseId: string;
  reps: number;
  loadKg: number;
  effortLabel: EffortLabel;
  notes?: string;
}

interface HistoricalSession {
  date: string;
  dayNumber: number;
  bodyweightKg?: number;
  sets: HistoricalSet[];
}

interface AppSettingRow {
  value: string;
}

interface DayTemplateLookupRow {
  id: number;
  day_number: number;
}

const historicalSessions = historicalSessionsJson as HistoricalSession[];

function generateWorkoutId(sessionIndex: number): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `history-workout-${sessionIndex + 1}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 10)}`;
}

function toStartedAtIso(date: string): string {
  return `${date}${DEFAULT_WORKOUT_START_HOUR}`;
}

function toCompletedAtIso(date: string): string {
  return `${date}${DEFAULT_WORKOUT_COMPLETE_HOUR}`;
}

export async function importTrainingHistory(): Promise<void> {
  try {
    const database = await getDatabase();
    const importedSetting = await database.getFirstAsync<AppSettingRow>(
      'SELECT value FROM app_settings WHERE key = ?;',
      [HISTORY_IMPORTED_KEY]
    );

    if (importedSetting?.value === HISTORY_IMPORTED_DONE) {
      return;
    }

    await database.withExclusiveTransactionAsync(async (transaction) => {
      const inTransactionImportedSetting = await transaction.getFirstAsync<AppSettingRow>(
        'SELECT value FROM app_settings WHERE key = ?;',
        [HISTORY_IMPORTED_KEY]
      );

      if (inTransactionImportedSetting?.value === HISTORY_IMPORTED_DONE) {
        return;
      }

      const dayTemplateRows = await transaction.getAllAsync<DayTemplateLookupRow>(
        `SELECT id, day_number
         FROM day_templates
         WHERE phase_id = ?;`,
        [HYBRID_PHASE_1_ID]
      );

      const dayTemplateIdByDayNumber = new Map<number, number>();
      for (const row of dayTemplateRows) {
        dayTemplateIdByDayNumber.set(row.day_number, row.id);
      }

      for (const requiredDayNumber of [1, 2, 3, 4, 5, 6]) {
        if (!dayTemplateIdByDayNumber.has(requiredDayNumber)) {
          throw new Error(
            `Cannot import history because day template ${requiredDayNumber} for ${HYBRID_PHASE_1_ID} is missing.`
          );
        }
      }

      for (const [sessionIndex, session] of historicalSessions.entries()) {
        const dayTemplateId = dayTemplateIdByDayNumber.get(session.dayNumber);
        if (!dayTemplateId) {
          throw new Error(`Missing day template id for day ${session.dayNumber}.`);
        }

        const workoutId = generateWorkoutId(sessionIndex);
        const startedAt = toStartedAtIso(session.date);
        const completedAt = toCompletedAtIso(session.date);

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
            workoutId,
            HYBRID_PHASE_1_ID,
            dayTemplateId,
            startedAt,
            completedAt,
            null,
            session.bodyweightKg ?? null,
            null,
          ]
        );

        const setOrderByExerciseId = new Map<string, number>();
        for (const set of session.sets) {
          const currentSetOrder = (setOrderByExerciseId.get(set.exerciseId) ?? 0) + 1;
          setOrderByExerciseId.set(set.exerciseId, currentSetOrder);

          await transaction.runAsync(
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
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?);`,
            [
              workoutId,
              set.exerciseId,
              currentSetOrder,
              set.reps,
              set.loadKg,
              set.effortLabel,
              startedAt,
              set.notes ?? null,
            ]
          );
        }

        if (typeof session.bodyweightKg === 'number') {
          await transaction.runAsync(
            `INSERT INTO bodyweight_log (
              workout_id,
              weight_kg,
              logged_at,
              source
            ) VALUES (?, ?, ?, 'workout');`,
            [workoutId, session.bodyweightKg, startedAt]
          );
        }
      }

      await transaction.runAsync(
        `INSERT INTO app_settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
        [FIRST_WORKOUT_TIMESTAMP_KEY, FIRST_WORKOUT_TIMESTAMP_VALUE]
      );

      await transaction.runAsync(
        `INSERT INTO app_settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
        [HISTORY_IMPORTED_KEY, HISTORY_IMPORTED_DONE]
      );
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`importTrainingHistory failed: ${error.message}`);
    }

    throw new Error('importTrainingHistory failed: Unknown database error');
  }
}
