import { exercises, exerciseMuscleMappings } from '../constants/exercises';
import {
  HYBRID_PHASE_1_ID,
  HYBRID_PROGRAM_ID,
  phaseOneProgramDays,
} from '../constants/programTemplates';
import { muscleGroups } from '../constants/mevThresholds';
import { getDatabase } from './schema';

const SEED_VERSION_KEY = 'seed_version';
const SEED_VERSION = '1';

interface DayTemplateRow {
  id: number;
}

interface SlotRow {
  id: number;
}

export async function seedDatabaseIfNeeded(): Promise<void> {
  const database = await getDatabase();

  const currentSeedVersion = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?;',
    [SEED_VERSION_KEY]
  );

  if (currentSeedVersion?.value === SEED_VERSION) {
    return;
  }

  await database.withExclusiveTransactionAsync(async (transaction) => {
    for (const muscleGroup of muscleGroups) {
      await transaction.runAsync(
        `INSERT INTO muscle_groups (
          id, display_name, size_category, mev_low, mev_high,
          optimal_low, optimal_high, mrv_low, mrv_high, evidence_grade
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          display_name = excluded.display_name,
          size_category = excluded.size_category,
          mev_low = excluded.mev_low,
          mev_high = excluded.mev_high,
          optimal_low = excluded.optimal_low,
          optimal_high = excluded.optimal_high,
          mrv_low = excluded.mrv_low,
          mrv_high = excluded.mrv_high,
          evidence_grade = excluded.evidence_grade;`,
        [
          muscleGroup.id,
          muscleGroup.displayName,
          muscleGroup.sizeCategory,
          muscleGroup.mevLow,
          muscleGroup.mevHigh,
          muscleGroup.optimalLow,
          muscleGroup.optimalHigh,
          muscleGroup.mrvLow,
          muscleGroup.mrvHigh,
          muscleGroup.evidenceGrade,
        ]
      );
    }

    for (const exercise of exercises) {
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

    for (const mapping of exerciseMuscleMappings) {
      await transaction.runAsync(
        `INSERT INTO exercise_muscle_mappings (exercise_id, muscle_group, role)
         VALUES (?, ?, ?)
         ON CONFLICT(exercise_id, muscle_group) DO UPDATE SET role = excluded.role;`,
        [mapping.exerciseId, mapping.muscleGroup, mapping.role]
      );
    }

    await transaction.runAsync(
      `INSERT INTO programs (id, name, is_active)
       VALUES (?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, is_active = excluded.is_active;`,
      [HYBRID_PROGRAM_ID, 'Hybrid Bodybuilding 2.0']
    );

    await transaction.runAsync(
      `INSERT INTO program_phases (id, program_id, name, phase_order, is_active)
       VALUES (?, ?, 'Phase 1', 1, 1)
       ON CONFLICT(id) DO UPDATE SET
         program_id = excluded.program_id,
         name = excluded.name,
         phase_order = excluded.phase_order,
         is_active = excluded.is_active;`,
      [HYBRID_PHASE_1_ID, HYBRID_PROGRAM_ID]
    );

    for (const day of phaseOneProgramDays) {
      await transaction.runAsync(
        `INSERT INTO day_templates (phase_id, day_number, day_name)
         VALUES (?, ?, ?)
         ON CONFLICT(phase_id, day_number) DO UPDATE SET day_name = excluded.day_name;`,
        [HYBRID_PHASE_1_ID, day.dayNumber, day.dayName]
      );

      const dayTemplateRow = await transaction.getFirstAsync<DayTemplateRow>(
        `SELECT id FROM day_templates WHERE phase_id = ? AND day_number = ?;`,
        [HYBRID_PHASE_1_ID, day.dayNumber]
      );

      if (!dayTemplateRow) {
        throw new Error(`Could not resolve day template id for day ${day.dayNumber}`);
      }

      for (const slot of day.slots) {
        await transaction.runAsync(
          `INSERT INTO template_exercise_slots (
            day_template_id,
            slot_order,
            default_exercise_id,
            target_sets,
            target_rep_low,
            target_rep_high,
            rest_seconds,
            notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(day_template_id, slot_order) DO UPDATE SET
            default_exercise_id = excluded.default_exercise_id,
            target_sets = excluded.target_sets,
            target_rep_low = excluded.target_rep_low,
            target_rep_high = excluded.target_rep_high,
            rest_seconds = excluded.rest_seconds,
            notes = excluded.notes;`,
          [
            dayTemplateRow.id,
            slot.slotOrder,
            slot.defaultExerciseId,
            slot.targetSets,
            slot.targetRepLow,
            slot.targetRepHigh,
            slot.restSeconds,
            slot.notes ?? null,
          ]
        );

        const slotRow = await transaction.getFirstAsync<SlotRow>(
          `SELECT id FROM template_exercise_slots
           WHERE day_template_id = ? AND slot_order = ?;`,
          [dayTemplateRow.id, slot.slotOrder]
        );

        if (!slotRow) {
          throw new Error(`Could not resolve slot id for day ${day.dayNumber}, slot ${slot.slotOrder}`);
        }

        await transaction.runAsync(
          'DELETE FROM slot_alternate_exercises WHERE slot_id = ?;',
          [slotRow.id]
        );

        for (const alternateExerciseId of slot.alternateExerciseIds ?? []) {
          await transaction.runAsync(
            `INSERT OR IGNORE INTO slot_alternate_exercises (slot_id, exercise_id)
             VALUES (?, ?);`,
            [slotRow.id, alternateExerciseId]
          );
        }
      }
    }

    await transaction.runAsync(
      `INSERT INTO app_settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      [SEED_VERSION_KEY, SEED_VERSION]
    );
  });
}
