import type { ExportPayload } from '../src/types';

jest.mock('expo-sqlite');

type QueriesModule = typeof import('../src/db/queries.native');

async function loadQueries(): Promise<QueriesModule> {
  jest.resetModules();
  jest.doMock('expo-sqlite');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const queries = require('../src/db/queries.native') as QueriesModule;
  await queries.initializeDatabase();
  return queries;
}

function makeMinimalValidPayload(): ExportPayload {
  return {
    exportedAt: '2026-04-01T00:00:00.000Z',
    workouts: [],
    sets: [],
    exercises: [],
    exercise_muscle_mappings: [],
    bodyweight_log: [],
    set_audit_log: [],
  };
}

describe('restoreFromExportData validation', () => {
  it('accepts a minimal valid payload', async () => {
    const queries = await loadQueries();
    const result = await queries.restoreFromExportData(makeMinimalValidPayload());
    expect(result.workouts).toBe(0);
    expect(result.sets).toBe(0);
    expect(result.bodyweightEntries).toBe(0);
  });

  it('rejects a payload missing the workouts array', async () => {
    const queries = await loadQueries();
    const payload = makeMinimalValidPayload() as Partial<ExportPayload>;
    delete payload.workouts;

    await expect(
      queries.restoreFromExportData(payload as ExportPayload)
    ).rejects.toThrow(/workouts/);
  });

  it('rejects a payload with non-array sets', async () => {
    const queries = await loadQueries();
    const payload = makeMinimalValidPayload();
    (payload as unknown as { sets: string }).sets = 'not an array';

    await expect(queries.restoreFromExportData(payload)).rejects.toThrow(/sets/);
  });

  it('rejects a set with invalid effortLabel enum', async () => {
    const queries = await loadQueries();
    const payload = makeMinimalValidPayload();
    payload.workouts.push({
      id: 'w1',
      phaseId: null,
      dayTemplateId: null,
      startedAt: '2026-04-01T10:00:00.000Z',
      completedAt: '2026-04-01T11:00:00.000Z',
      prsScore: null,
      bodyweightKg: null,
      notes: null,
    });
    payload.sets.push({
      id: 1,
      workoutId: 'w1',
      exerciseId: 'barbell-bench-press',
      setOrder: 1,
      reps: 5,
      loadKg: 60,
      // @ts-expect-error invalid enum value
      effortLabel: 'gentle',
      isWarmup: false,
      loggedAt: '2026-04-01T10:00:00.000Z',
      notes: null,
      updatedAt: null,
      deletedAt: null,
    });

    await expect(queries.restoreFromExportData(payload)).rejects.toThrow(
      /effortLabel/
    );
  });

  it('rejects a set with non-boolean isWarmup', async () => {
    const queries = await loadQueries();
    const payload = makeMinimalValidPayload();
    payload.workouts.push({
      id: 'w1',
      phaseId: null,
      dayTemplateId: null,
      startedAt: '2026-04-01T10:00:00.000Z',
      completedAt: null,
      prsScore: null,
      bodyweightKg: null,
      notes: null,
    });
    payload.sets.push({
      id: 1,
      workoutId: 'w1',
      exerciseId: 'barbell-bench-press',
      setOrder: 1,
      reps: 5,
      loadKg: 60,
      effortLabel: 'productive',
      // @ts-expect-error invalid boolean
      isWarmup: 1,
      loggedAt: '2026-04-01T10:00:00.000Z',
      notes: null,
    });

    await expect(queries.restoreFromExportData(payload)).rejects.toThrow(
      /isWarmup/
    );
  });

  it('rejects a mapping with invalid role enum', async () => {
    const queries = await loadQueries();
    const payload = makeMinimalValidPayload();
    payload.exercise_muscle_mappings.push({
      exerciseId: 'barbell-bench-press',
      muscleGroup: 'chest',
      // @ts-expect-error invalid enum
      role: 'tertiary',
    });

    await expect(queries.restoreFromExportData(payload)).rejects.toThrow(/role/);
  });

  it('rejects a bodyweight entry with non-finite weight', async () => {
    const queries = await loadQueries();
    const payload = makeMinimalValidPayload();
    payload.bodyweight_log.push({
      id: 1,
      workoutId: null,
      // @ts-expect-error testing invalid value
      weightKg: 'heavy',
      loggedAt: '2026-04-01T10:00:00.000Z',
      source: 'manual',
    });

    await expect(queries.restoreFromExportData(payload)).rejects.toThrow(
      /weightKg/
    );
  });

  it('rejects an audit log entry with malformed JSON in beforeJson', async () => {
    const queries = await loadQueries();
    const payload = makeMinimalValidPayload();
    payload.set_audit_log = [
      {
        id: 1,
        setId: 1,
        workoutId: 'w1',
        action: 'delete',
        beforeJson: '{ this is not valid json',
        afterJson: null,
        changedAt: '2026-04-01T10:00:00.000Z',
      },
    ];

    await expect(queries.restoreFromExportData(payload)).rejects.toThrow(
      /JSON/
    );
  });

  it('preserves existing data when validation fails', async () => {
    const queries = await loadQueries();

    // Seed: log a workout/set so we have data to lose.
    const dayTemplate = await queries.getDayTemplateByDayNumber(1);
    const { workoutId } = await queries.createWorkoutSession({
      dayTemplateId: dayTemplate.id,
      prsScore: 7,
      bodyweightKg: null,
      startedAtOverride: '2026-04-01T10:00:00.000Z',
    });
    await queries.logSet({
      workoutId,
      exerciseId: dayTemplate.slots[0]?.defaultExerciseId ?? 'broad-jumps',
      reps: 5,
      loadKg: 0,
      effortLabel: 'hard',
      isWarmup: false,
      notes: null,
      loggedAtOverride: '2026-04-01T10:00:00.000Z',
    });
    await queries.completeWorkoutSession({
      workoutId,
      notes: null,
      completedAt: '2026-04-01T11:00:00.000Z',
    });

    const beforeExport = await queries.exportAllData();
    const setsBefore = beforeExport.sets.length;

    // Invalid payload should throw without touching the DB.
    const badPayload = makeMinimalValidPayload();
    (badPayload as unknown as { workouts: string }).workouts = 'oops';

    await expect(
      queries.restoreFromExportData(badPayload as unknown as ExportPayload)
    ).rejects.toThrow();

    const afterExport = await queries.exportAllData();
    expect(afterExport.sets.length).toBe(setsBefore);
  });
});
