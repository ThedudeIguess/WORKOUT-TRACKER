type QueriesModule = typeof import('../src/db/queries.web');

async function loadQueries(): Promise<QueriesModule> {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const queries = require('../src/db/queries.web') as QueriesModule;
  await queries.initializeDatabase();
  return queries;
}

describe('db integration', () => {
  it('creates and reads completed workout details', async () => {
    const queries = await loadQueries();
    const dayTemplate = await queries.getDayTemplateByDayNumber(1);

    const { workoutId } = await queries.createWorkoutSession({
      dayTemplateId: dayTemplate.id,
      prsScore: 7,
      bodyweightKg: 82.5,
    });

    await queries.logSet({
      workoutId,
      exerciseId: dayTemplate.slots[0]?.defaultExerciseId ?? 'broad-jumps',
      reps: 5,
      loadKg: 0,
      effortLabel: 'hard',
      isWarmup: false,
      notes: null,
    });

    await queries.logSet({
      workoutId,
      exerciseId: dayTemplate.slots[1]?.defaultExerciseId ?? 'barbell-back-squat',
      reps: 8,
      loadKg: 100,
      effortLabel: 'productive',
      isWarmup: false,
      notes: null,
    });

    await queries.completeWorkoutSession({
      workoutId,
      notes: 'integration test session',
    });

    const history = await queries.getWorkoutHistory(10);
    expect(history.length).toBe(1);
    expect(history[0]?.workoutId).toBe(workoutId);
    expect(history[0]?.totalSets).toBe(2);

    const detail = await queries.getWorkoutDetail(workoutId);
    expect(detail).not.toBeNull();
    expect(detail?.workoutId).toBe(workoutId);
    expect(detail?.totalSets).toBe(2);
    expect(detail?.sets.length).toBe(2);
  });

  it('updates exercise active status in library', async () => {
    const queries = await loadQueries();
    const library = await queries.listExerciseLibrary();
    const exercise = library.find((item) => item.id === 'barbell-back-squat');
    expect(exercise).toBeDefined();
    expect(exercise?.isActive).toBe(true);

    await queries.setExerciseActive({
      exerciseId: 'barbell-back-squat',
      isActive: false,
    });

    const activeOptions = await queries.listExercises();
    expect(activeOptions.some((item) => item.id === 'barbell-back-squat')).toBe(false);

    const updatedLibrary = await queries.listExerciseLibrary();
    const updated = updatedLibrary.find((item) => item.id === 'barbell-back-squat');
    expect(updated?.isActive).toBe(false);
  });

  it('updates program day names and slot targets', async () => {
    const queries = await loadQueries();
    const dayTemplates = await queries.listProgramDayTemplates();
    const firstDay = dayTemplates[0];
    if (!firstDay) {
      throw new Error('Expected seeded program day templates.');
    }

    await queries.updateDayTemplateName({
      dayTemplateId: firstDay.id,
      dayName: 'Lower A Edited',
    });

    const firstSlot = firstDay.slots[0];
    if (!firstSlot) {
      throw new Error('Expected seeded day template slot.');
    }
    await queries.updateTemplateExerciseSlot({
      slotId: firstSlot.id,
      targetSets: 4,
      targetRepLow: 4,
      targetRepHigh: 6,
      restSeconds: 150,
      notes: 'edited slot',
    });

    const updated = await queries.listProgramDayTemplates();
    const updatedDay = updated.find((day) => day.id === firstDay.id);
    const updatedSlot = updatedDay?.slots.find((slot) => slot.id === firstSlot.id);

    expect(updatedDay?.dayName).toBe('Lower A Edited');
    expect(updatedSlot?.targetSets).toBe(4);
    expect(updatedSlot?.targetRepLow).toBe(4);
    expect(updatedSlot?.targetRepHigh).toBe(6);
    expect(updatedSlot?.restSeconds).toBe(150);
    expect(updatedSlot?.notes).toBe('edited slot');
  });

  it('restores workouts, sets, and bodyweight from exported data', async () => {
    const queries = await loadQueries();
    const dayTemplate = await queries.getDayTemplateByDayNumber(2);

    const { workoutId } = await queries.createWorkoutSession({
      dayTemplateId: dayTemplate.id,
      prsScore: 8,
      bodyweightKg: 81.2,
    });

    await queries.logSet({
      workoutId,
      exerciseId: dayTemplate.slots[0]?.defaultExerciseId ?? 'barbell-bench-press',
      reps: 8,
      loadKg: 80,
      effortLabel: 'hard',
      isWarmup: false,
      notes: null,
    });

    await queries.completeWorkoutSession({
      workoutId,
      notes: null,
    });

    await queries.logBodyweight({ weightKg: 80.9 });
    const baselineExport = await queries.exportAllData();

    const otherWorkout = await queries.createWorkoutSession({
      dayTemplateId: dayTemplate.id,
      prsScore: 5,
      bodyweightKg: null,
    });
    await queries.logSet({
      workoutId: otherWorkout.workoutId,
      exerciseId: dayTemplate.slots[1]?.defaultExerciseId ?? 'assisted-dips',
      reps: 10,
      loadKg: 40,
      effortLabel: 'productive',
      isWarmup: false,
      notes: null,
    });
    await queries.completeWorkoutSession({
      workoutId: otherWorkout.workoutId,
      notes: 'temporary data',
    });

    const restoreSummary = await queries.restoreFromExportData(baselineExport);
    expect(restoreSummary.workouts).toBe(baselineExport.workouts.length);
    expect(restoreSummary.sets).toBe(baselineExport.sets.length);

    const restoredExport = await queries.exportAllData();
    expect(restoredExport.workouts.length).toBe(baselineExport.workouts.length);
    expect(restoredExport.sets.length).toBe(baselineExport.sets.length);
    expect(restoredExport.bodyweight_log.length).toBe(
      baselineExport.bodyweight_log.length
    );
  });

  it('tracks first workout anchor from earliest completed workout started_at', async () => {
    const queries = await loadQueries();
    const dayTemplate = await queries.getDayTemplateByDayNumber(1);

    const firstStartedAt = '2026-01-10T10:00:00.000Z';
    const firstCompletedAt = '2026-01-10T11:00:00.000Z';
    const secondStartedAt = '2026-01-05T09:00:00.000Z';
    const secondCompletedAt = '2026-01-12T09:00:00.000Z';

    const firstWorkout = await queries.createWorkoutSession({
      dayTemplateId: dayTemplate.id,
      prsScore: 7,
      bodyweightKg: null,
      startedAtOverride: firstStartedAt,
    });
    await queries.logSet({
      workoutId: firstWorkout.workoutId,
      exerciseId: dayTemplate.slots[0]?.defaultExerciseId ?? 'broad-jumps',
      reps: 5,
      loadKg: 0,
      effortLabel: 'hard',
      isWarmup: false,
      notes: null,
      loggedAtOverride: firstStartedAt,
    });
    await queries.completeWorkoutSession({
      workoutId: firstWorkout.workoutId,
      notes: null,
      completedAt: firstCompletedAt,
    });

    expect(await queries.getFirstWorkoutAnchor()).toBe(firstStartedAt);

    const secondWorkout = await queries.createWorkoutSession({
      dayTemplateId: dayTemplate.id,
      prsScore: 8,
      bodyweightKg: null,
      startedAtOverride: secondStartedAt,
    });
    await queries.logSet({
      workoutId: secondWorkout.workoutId,
      exerciseId: dayTemplate.slots[1]?.defaultExerciseId ?? 'barbell-back-squat',
      reps: 8,
      loadKg: 100,
      effortLabel: 'productive',
      isWarmup: false,
      notes: null,
      loggedAtOverride: secondStartedAt,
    });
    await queries.completeWorkoutSession({
      workoutId: secondWorkout.workoutId,
      notes: null,
      completedAt: secondCompletedAt,
    });

    expect(await queries.getFirstWorkoutAnchor()).toBe(secondStartedAt);
  });
});
