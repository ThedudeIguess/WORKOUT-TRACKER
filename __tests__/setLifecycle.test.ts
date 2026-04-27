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

async function createCompletedWorkoutWithSet(
  queries: QueriesModule,
  startedAtIso: string,
  completedAtIso: string
): Promise<{ workoutId: string; setId: number }> {
  const dayTemplate = await queries.getDayTemplateByDayNumber(2);
  const exerciseId =
    dayTemplate.slots[0]?.defaultExerciseId ?? 'barbell-bench-press';

  const { workoutId } = await queries.createWorkoutSession({
    dayTemplateId: dayTemplate.id,
    prsScore: 8,
    bodyweightKg: null,
    startedAtOverride: startedAtIso,
  });

  const { setId } = await queries.logSet({
    workoutId,
    exerciseId,
    reps: 8,
    loadKg: 60,
    effortLabel: 'productive',
    isWarmup: false,
    notes: null,
    loggedAtOverride: startedAtIso,
  });

  await queries.completeWorkoutSession({
    workoutId,
    notes: null,
    completedAt: completedAtIso,
  });

  return { workoutId, setId };
}

describe('set lifecycle (soft delete + audit log)', () => {
  describe('updateSet', () => {
    it('updates the set and writes a before/after audit log entry', async () => {
      const queries = await loadQueries();
      const { workoutId, setId } = await createCompletedWorkoutWithSet(
        queries,
        '2026-04-01T10:00:00.000Z',
        '2026-04-01T11:00:00.000Z'
      );

      await queries.updateSet({
        setId,
        reps: 10,
        loadKg: 65,
        effortLabel: 'hard',
        isWarmup: false,
        notes: 'pushed harder',
      });

      const detail = await queries.getWorkoutDetail(workoutId);
      const updatedSet = detail?.sets.find((set) => set.id === setId);
      expect(updatedSet?.reps).toBe(10);
      expect(updatedSet?.loadKg).toBe(65);
      expect(updatedSet?.effortLabel).toBe('hard');
      expect(updatedSet?.notes).toBe('pushed harder');

      const exportPayload = await queries.exportAllData();
      const updateEntries = (exportPayload.set_audit_log ?? []).filter(
        (entry) => entry.setId === setId && entry.action === 'update'
      );
      expect(updateEntries).toHaveLength(1);

      const before = JSON.parse(updateEntries[0]!.beforeJson);
      expect(before.reps).toBe(8);
      expect(before.loadKg).toBe(60);
      expect(before.effortLabel).toBe('productive');

      const after = JSON.parse(updateEntries[0]!.afterJson ?? '{}');
      expect(after.reps).toBe(10);
      expect(after.loadKg).toBe(65);
      expect(after.effortLabel).toBe('hard');
    });

    it('writes a separate audit entry per update', async () => {
      const queries = await loadQueries();
      const { setId } = await createCompletedWorkoutWithSet(
        queries,
        '2026-04-02T10:00:00.000Z',
        '2026-04-02T11:00:00.000Z'
      );

      await queries.updateSet({
        setId,
        reps: 9,
        loadKg: 62.5,
        effortLabel: 'productive',
        isWarmup: false,
        notes: null,
      });
      await queries.updateSet({
        setId,
        reps: 10,
        loadKg: 65,
        effortLabel: 'hard',
        isWarmup: false,
        notes: null,
      });

      const exportPayload = await queries.exportAllData();
      const updates = (exportPayload.set_audit_log ?? []).filter(
        (entry) => entry.setId === setId && entry.action === 'update'
      );
      expect(updates).toHaveLength(2);
    });
  });

  describe('deleteSet', () => {
    it('soft-deletes the set (deleted_at set) and writes an audit entry', async () => {
      const queries = await loadQueries();
      const { workoutId, setId } = await createCompletedWorkoutWithSet(
        queries,
        '2026-04-03T10:00:00.000Z',
        '2026-04-03T11:00:00.000Z'
      );

      await queries.deleteSet(setId);

      const detail = await queries.getWorkoutDetail(workoutId);
      expect(detail?.sets.find((set) => set.id === setId)).toBeUndefined();

      const exportPayload = await queries.exportAllData();
      const deleted = exportPayload.sets.find((set) => set.id === setId);
      expect(deleted).toBeDefined();
      expect(deleted?.deletedAt).not.toBeNull();

      const audit = (exportPayload.set_audit_log ?? []).find(
        (entry) => entry.setId === setId && entry.action === 'delete'
      );
      expect(audit).toBeDefined();
      const before = JSON.parse(audit!.beforeJson);
      expect(before.reps).toBe(8);
      expect(before.deletedAt).toBeNull();

      const after = JSON.parse(audit!.afterJson ?? '{}');
      expect(after.deletedAt).not.toBeNull();
    });

    it('excludes deleted sets from volume calculations', async () => {
      const queries = await loadQueries();
      const startedAt = '2026-04-04T10:00:00.000Z';
      const completedAt = '2026-04-04T11:00:00.000Z';
      const { setId } = await createCompletedWorkoutWithSet(
        queries,
        startedAt,
        completedAt
      );

      const beforeSets = await queries.getSetsByDateRange(
        '2026-04-04T00:00:00.000Z',
        '2026-04-05T00:00:00.000Z'
      );
      expect(beforeSets.length).toBe(1);

      await queries.deleteSet(setId);

      const afterSets = await queries.getSetsByDateRange(
        '2026-04-04T00:00:00.000Z',
        '2026-04-05T00:00:00.000Z'
      );
      expect(afterSets.length).toBe(0);
    });

    it('excludes deleted sets from getMostRecentLoad', async () => {
      const queries = await loadQueries();
      const dayTemplate = await queries.getDayTemplateByDayNumber(2);
      const exerciseId =
        dayTemplate.slots[0]?.defaultExerciseId ?? 'barbell-bench-press';

      const { workoutId } = await queries.createWorkoutSession({
        dayTemplateId: dayTemplate.id,
        prsScore: 7,
        bodyweightKg: null,
        startedAtOverride: '2026-04-05T10:00:00.000Z',
      });

      // Heavy set first, lighter set second.
      const { setId: heavySetId } = await queries.logSet({
        workoutId,
        exerciseId,
        reps: 5,
        loadKg: 80,
        effortLabel: 'hard',
        isWarmup: false,
        notes: null,
        loggedAtOverride: '2026-04-05T10:00:00.000Z',
      });

      await queries.logSet({
        workoutId,
        exerciseId,
        reps: 8,
        loadKg: 60,
        effortLabel: 'productive',
        isWarmup: false,
        notes: null,
        loggedAtOverride: '2026-04-05T10:30:00.000Z',
      });

      // Most recent (live) set is the 60kg one.
      expect(await queries.getMostRecentLoad(exerciseId)).toBe(60);

      // Deleting the 60kg set leaves the 80kg as the most recent live set.
      await queries.completeWorkoutSession({
        workoutId,
        notes: null,
        completedAt: '2026-04-05T11:00:00.000Z',
      });

      // Find the 60kg set id and delete it.
      const detail = await queries.getWorkoutDetail(workoutId);
      const lighterSet = detail?.sets.find(
        (set) => set.exerciseId === exerciseId && set.loadKg === 60
      );
      expect(lighterSet).toBeDefined();
      await queries.deleteSet(lighterSet!.id);

      expect(await queries.getMostRecentLoad(exerciseId)).toBe(80);
      expect(heavySetId).toBeGreaterThan(0);
    });
  });
});
