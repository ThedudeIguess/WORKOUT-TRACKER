import {
  exercises,
  exerciseMuscleMappings,
} from '../constants/exercises';
import {
  HYBRID_PHASE_1_ID,
  phaseOneProgramDays,
  placeholderDayTemplate,
} from '../constants/programTemplates';
import {
  type ActiveWorkoutSummary,
  type BodyweightEntry,
  type DayTemplateWithSlots,
  type EffortLabel,
  type ExportPayload,
  type Exercise,
  type ExerciseMuscleMapping,
  type LoggedSet,
  type ProgressionExposure,
  type SetForVolume,
  type StrengthTrendPoint,
  type WorkoutDetail,
  type WorkoutDetailSet,
  type Workout,
  type WorkoutHistoryItem,
} from '../types';

const APP_SETTING_FIRST_WORKOUT_ANCHOR = 'first_workout_timestamp';
const APP_SETTING_THEME = 'theme';
const APP_SETTING_DEFAULT_REST_SECONDS = 'default_rest_seconds';
const APP_SETTING_UNITS = 'units';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface InMemoryState {
  initialized: boolean;
  appSettings: Map<string, string>;
  exerciseLibrary: Exercise[];
  exerciseMappings: ExerciseMuscleMapping[];
  workouts: Workout[];
  sets: LoggedSet[];
  bodyweightLog: BodyweightEntry[];
  dayTemplates: DayTemplateWithSlots[];
  nextSetId: number;
  nextBodyweightId: number;
}

const state: InMemoryState = {
  initialized: false,
  appSettings: new Map<string, string>(),
  exerciseLibrary: [],
  exerciseMappings: [],
  workouts: [],
  sets: [],
  bodyweightLog: [],
  dayTemplates: [],
  nextSetId: 1,
  nextBodyweightId: 1,
};

const exerciseById = new Map<string, Exercise>(
  exercises.map((exercise) => [exercise.id, exercise])
);

function generateWorkoutId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `workout-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function parseIso(isoString: string | null | undefined): number {
  if (!isoString) {
    return 0;
  }

  const value = new Date(isoString).getTime();
  return Number.isFinite(value) ? value : 0;
}

function getExerciseById(exerciseId: string): Exercise | null {
  return state.exerciseLibrary.find((exercise) => exercise.id === exerciseId) ?? null;
}

function cloneTemplate(template: DayTemplateWithSlots): DayTemplateWithSlots {
  return {
    ...template,
    slots: template.slots.map((slot) => ({
      ...slot,
      alternateExercises: [...slot.alternateExercises],
    })),
  };
}

function buildDayTemplates(): DayTemplateWithSlots[] {
  let slotId = 1;

  return phaseOneProgramDays
    .slice()
    .sort((left, right) => left.dayNumber - right.dayNumber)
    .map((day) => ({
      id: day.dayNumber,
      phaseId: HYBRID_PHASE_1_ID,
      dayNumber: day.dayNumber,
      dayName: day.dayName,
      slots: day.slots
        .slice()
        .sort((left, right) => left.slotOrder - right.slotOrder)
        .map((slot) => {
          const defaultExercise = exerciseById.get(slot.defaultExerciseId);
          if (!defaultExercise) {
            throw new Error(`Missing seeded exercise for ${slot.defaultExerciseId}`);
          }

          const alternateExercises = (slot.alternateExerciseIds ?? [])
            .map((alternateExerciseId) => {
              const alternateExercise = exerciseById.get(alternateExerciseId);
              if (!alternateExercise) {
                return null;
              }

              return {
                id: alternateExercise.id,
                name: alternateExercise.name,
              };
            })
            .filter((option): option is { id: string; name: string } => option !== null)
            .sort((left, right) => left.name.localeCompare(right.name));

          const builtSlot = {
            id: slotId,
            dayTemplateId: day.dayNumber,
            slotOrder: slot.slotOrder,
            defaultExerciseId: slot.defaultExerciseId,
            defaultExerciseName: defaultExercise.name,
            inputMode: slot.inputMode ?? 'reps',
            targetSets: slot.targetSets,
            targetRepLow: slot.targetRepLow,
            targetRepHigh: slot.targetRepHigh,
            restSeconds: slot.restSeconds,
            notes: slot.notes ?? null,
            alternateExercises,
          };

          slotId += 1;
          return builtSlot;
        }),
    }));
}

function findDayTemplate(dayTemplateId: number): DayTemplateWithSlots | null {
  return state.dayTemplates.find((template) => template.id === dayTemplateId) ?? null;
}

function findDayTemplateByDayNumber(dayNumber: number): DayTemplateWithSlots | null {
  return state.dayTemplates.find((template) => template.dayNumber === dayNumber) ?? null;
}

function setDefaultAppSettings(): void {
  if (!state.appSettings.has(APP_SETTING_THEME)) {
    state.appSettings.set(APP_SETTING_THEME, 'dark');
  }

  if (!state.appSettings.has(APP_SETTING_DEFAULT_REST_SECONDS)) {
    state.appSettings.set(APP_SETTING_DEFAULT_REST_SECONDS, '90');
  }

  if (!state.appSettings.has(APP_SETTING_UNITS)) {
    state.appSettings.set(APP_SETTING_UNITS, 'kg');
  }
}

function ensureInitialized(): void {
  if (state.initialized) {
    return;
  }

  state.exerciseLibrary = exercises.map((exercise) => ({ ...exercise }));
  state.exerciseMappings = exerciseMuscleMappings.map((mapping) => ({ ...mapping }));
  state.dayTemplates = buildDayTemplates();
  setDefaultAppSettings();
  state.initialized = true;
}

function getEarliestCompletedWorkoutStartedAt(): string | null {
  const earliest = state.workouts
    .filter((workout) => workout.completedAt !== null)
    .slice()
    .sort((left, right) => parseIso(left.startedAt) - parseIso(right.startedAt))[0];

  return earliest?.startedAt ?? null;
}

export async function initializeDatabase(): Promise<void> {
  ensureInitialized();
}

export async function getAppSetting(key: string): Promise<string | null> {
  ensureInitialized();
  return state.appSettings.get(key) ?? null;
}

export async function setAppSetting(
  key: string,
  value: string,
  preserveExisting = false
): Promise<void> {
  ensureInitialized();

  if (preserveExisting && state.appSettings.has(key)) {
    return;
  }

  state.appSettings.set(key, value);
}

export async function createWorkoutSession(input: {
  dayTemplateId: number;
  phaseId?: string;
  prsScore: number | null;
  bodyweightKg: number | null;
  startedAtOverride?: string;
}): Promise<{ workoutId: string }> {
  ensureInitialized();

  const workoutId = generateWorkoutId();
  const startedAt = input.startedAtOverride ?? new Date().toISOString();

  const workout: Workout = {
    id: workoutId,
    phaseId: input.phaseId ?? HYBRID_PHASE_1_ID,
    dayTemplateId: input.dayTemplateId,
    startedAt,
    completedAt: null,
    prsScore: input.prsScore,
    bodyweightKg: input.bodyweightKg,
    notes: null,
  };

  state.workouts.push(workout);

  if (input.bodyweightKg !== null && Number.isFinite(input.bodyweightKg)) {
    state.bodyweightLog.push({
      id: state.nextBodyweightId,
      workoutId,
      weightKg: input.bodyweightKg,
      loggedAt: startedAt,
      source: 'workout',
    });
    state.nextBodyweightId += 1;
  }

  return { workoutId };
}

export async function completeWorkoutSession(input: {
  workoutId: string;
  notes: string | null;
  completedAt?: string;
}): Promise<void> {
  ensureInitialized();

  const workout = state.workouts.find((candidate) => candidate.id === input.workoutId);
  if (!workout) {
    return;
  }

  workout.completedAt = input.completedAt ?? new Date().toISOString();
  workout.notes = input.notes;

  const anchor = getEarliestCompletedWorkoutStartedAt();
  if (anchor) {
    state.appSettings.set(APP_SETTING_FIRST_WORKOUT_ANCHOR, anchor);
  } else {
    state.appSettings.delete(APP_SETTING_FIRST_WORKOUT_ANCHOR);
  }
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
  ensureInitialized();

  const existingSetOrder = state.sets
    .filter(
      (candidate) =>
        candidate.workoutId === input.workoutId &&
        candidate.exerciseId === input.exerciseId
    )
    .reduce((maxOrder, candidate) => Math.max(maxOrder, candidate.setOrder), 0);

  const setId = state.nextSetId;
  state.nextSetId += 1;

  state.sets.push({
    id: setId,
    workoutId: input.workoutId,
    exerciseId: input.exerciseId,
    setOrder: existingSetOrder + 1,
    reps: input.reps,
    loadKg: input.loadKg,
    effortLabel: input.effortLabel,
    isWarmup: input.isWarmup,
    loggedAt: input.loggedAtOverride ?? new Date().toISOString(),
    notes: input.notes,
  });

  return { setId };
}

export async function getWorkoutSets(workoutId: string): Promise<LoggedSet[]> {
  ensureInitialized();

  return state.sets
    .filter((set) => set.workoutId === workoutId)
    .slice()
    .sort((left, right) => {
      const timeDelta = parseIso(left.loggedAt) - parseIso(right.loggedAt);
      if (timeDelta !== 0) {
        return timeDelta;
      }
      return left.setOrder - right.setOrder;
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
  ensureInitialized();

  const set = state.sets.find((candidate) => candidate.id === input.setId);
  if (!set) {
    return;
  }

  set.reps = input.reps;
  set.loadKg = input.loadKg;
  set.effortLabel = input.effortLabel;
  set.isWarmup = input.isWarmup;
  set.notes = input.notes;
}

export async function getSetsByDateRange(
  startIso: string,
  endIso: string
): Promise<SetForVolume[]> {
  ensureInitialized();

  const start = parseIso(startIso);
  const end = parseIso(endIso);
  const completedWorkoutIds = new Set(
    state.workouts
      .filter((workout) => workout.completedAt !== null)
      .map((workout) => workout.id)
  );

  return state.sets
    .filter((set) => {
      const loggedAt = parseIso(set.loggedAt);
      return (
        completedWorkoutIds.has(set.workoutId) &&
        loggedAt >= start &&
        loggedAt < end
      );
    })
    .slice()
    .sort((left, right) => {
      const timeDelta = parseIso(left.loggedAt) - parseIso(right.loggedAt);
      if (timeDelta !== 0) {
        return timeDelta;
      }
      return left.id - right.id;
    })
    .map((set) => {
      const exercise = getExerciseById(set.exerciseId);
      return {
        setId: set.id,
        exerciseId: set.exerciseId,
        exerciseName: exercise?.name ?? set.exerciseId,
        category: exercise?.category ?? 'compound',
        reps: set.reps,
        loadKg: set.loadKg,
        effortLabel: set.effortLabel,
        isWarmup: set.isWarmup,
        loggedAt: set.loggedAt,
        mappings: state.exerciseMappings
          .filter((mapping) => mapping.exerciseId === set.exerciseId)
          .map((mapping) => ({
            muscleGroup: mapping.muscleGroup,
            role: mapping.role,
          })),
      };
    });
}

export async function getMostRecentLoad(
  exerciseId: string
): Promise<number | null> {
  ensureInitialized();

  const latest = state.sets
    .filter((set) => set.exerciseId === exerciseId && !set.isWarmup)
    .slice()
    .sort((left, right) => parseIso(right.loggedAt) - parseIso(left.loggedAt))[0];

  return latest?.loadKg ?? null;
}

export async function getDayTemplateByDayNumber(
  dayNumber: number
): Promise<DayTemplateWithSlots> {
  ensureInitialized();
  const template = findDayTemplateByDayNumber(dayNumber);
  return template ? cloneTemplate(template) : placeholderDayTemplate;
}

export async function getDayTemplateById(
  dayTemplateId: number
): Promise<DayTemplateWithSlots | null> {
  ensureInitialized();
  const template = findDayTemplate(dayTemplateId);
  return template ? cloneTemplate(template) : null;
}

export async function listProgramDayTemplates(
  phaseId = HYBRID_PHASE_1_ID
): Promise<DayTemplateWithSlots[]> {
  ensureInitialized();

  return state.dayTemplates
    .filter((template) => template.phaseId === phaseId)
    .slice()
    .sort((left, right) => left.dayNumber - right.dayNumber)
    .map((template) => cloneTemplate(template));
}

export async function updateDayTemplateName(input: {
  dayTemplateId: number;
  dayName: string;
}): Promise<void> {
  ensureInitialized();

  state.dayTemplates = state.dayTemplates.map((template) =>
    template.id === input.dayTemplateId
      ? { ...template, dayName: input.dayName }
      : template
  );
}

export async function updateTemplateExerciseSlot(input: {
  slotId: number;
  targetSets: number;
  targetRepLow: number;
  targetRepHigh: number;
  restSeconds: number;
  notes: string | null;
}): Promise<void> {
  ensureInitialized();

  state.dayTemplates = state.dayTemplates.map((template) => ({
    ...template,
    slots: template.slots.map((slot) =>
      slot.id === input.slotId
        ? {
            ...slot,
            targetSets: input.targetSets,
            targetRepLow: input.targetRepLow,
            targetRepHigh: input.targetRepHigh,
            restSeconds: input.restSeconds,
            notes: input.notes,
          }
        : slot
    ),
  }));
}

export async function getActiveWorkout(): Promise<ActiveWorkoutSummary | null> {
  ensureInitialized();

  const activeWorkout = state.workouts
    .filter((workout) => workout.completedAt === null)
    .slice()
    .sort((left, right) => parseIso(right.startedAt) - parseIso(left.startedAt))[0];

  if (!activeWorkout || activeWorkout.dayTemplateId === null) {
    return null;
  }

  const dayTemplate = findDayTemplate(activeWorkout.dayTemplateId);
  if (!dayTemplate) {
    return null;
  }

  return {
    workoutId: activeWorkout.id,
    dayTemplateId: dayTemplate.id,
    dayNumber: dayTemplate.dayNumber,
    dayName: dayTemplate.dayName,
    startedAt: activeWorkout.startedAt,
  };
}

export async function getNextDayTemplate(): Promise<DayTemplateWithSlots> {
  ensureInitialized();

  const totalDays = state.dayTemplates.length;
  if (totalDays === 0) {
    return placeholderDayTemplate;
  }

  const latestCompleted = state.workouts
    .filter((workout) => workout.completedAt !== null)
    .slice()
    .sort((left, right) => parseIso(right.completedAt) - parseIso(left.completedAt))[0];

  if (!latestCompleted || latestCompleted.dayTemplateId === null) {
    return cloneTemplate(state.dayTemplates[0]);
  }

  const latestTemplate = findDayTemplate(latestCompleted.dayTemplateId);
  const latestDayNumber = latestTemplate?.dayNumber ?? 1;
  const nextDayNumber = (latestDayNumber % totalDays) + 1;

  return cloneTemplate(findDayTemplateByDayNumber(nextDayNumber) ?? state.dayTemplates[0]);
}

export async function getWorkoutHistory(
  limit = 50
): Promise<WorkoutHistoryItem[]> {
  ensureInitialized();

  const completed = state.workouts
    .filter((workout) => workout.completedAt !== null)
    .slice()
    .sort((left, right) => parseIso(right.completedAt) - parseIso(left.completedAt))
    .slice(0, limit);

  return completed.map((workout) => {
    const template =
      workout.dayTemplateId !== null
        ? findDayTemplate(workout.dayTemplateId)
        : null;

    const durationMinutes = Math.max(
      0,
      Math.floor(
        (parseIso(workout.completedAt) - parseIso(workout.startedAt)) /
          (60 * 1000)
      )
    );

    const totalSets = state.sets.filter((set) => set.workoutId === workout.id).length;

    return {
      workoutId: workout.id,
      dayName: template?.dayName ?? 'Workout',
      dayNumber: template?.dayNumber ?? 1,
      startedAt: workout.startedAt,
      completedAt: workout.completedAt ?? workout.startedAt,
      prsScore: workout.prsScore,
      durationMinutes,
      totalSets,
    };
  });
}

export async function getWorkoutDetail(
  workoutId: string
): Promise<WorkoutDetail | null> {
  ensureInitialized();

  const workout = state.workouts.find((candidate) => candidate.id === workoutId);
  if (!workout) {
    return null;
  }

  const template =
    workout.dayTemplateId !== null
      ? findDayTemplate(workout.dayTemplateId)
      : null;

  const sets: WorkoutDetailSet[] = state.sets
    .filter((set) => set.workoutId === workout.id)
    .slice()
    .sort((left, right) => {
      const loggedDelta = parseIso(left.loggedAt) - parseIso(right.loggedAt);
      if (loggedDelta !== 0) {
        return loggedDelta;
      }
      return left.id - right.id;
    })
    .map((set) => {
      const exercise = getExerciseById(set.exerciseId);

      return {
        id: set.id,
        workoutId: set.workoutId,
        exerciseId: set.exerciseId,
        exerciseName: exercise?.name ?? set.exerciseId,
        exerciseCategory: exercise?.category ?? 'compound',
        setOrder: set.setOrder,
        reps: set.reps,
        loadKg: set.loadKg,
        effortLabel: set.effortLabel,
        isWarmup: set.isWarmup,
        loggedAt: set.loggedAt,
        notes: set.notes,
      };
    });

  const durationMinutes = Math.max(
    0,
    Math.floor(
      (parseIso(workout.completedAt ?? workout.startedAt) - parseIso(workout.startedAt)) /
        (60 * 1000)
    )
  );

  return {
    workoutId: workout.id,
    dayName: template?.dayName ?? 'Workout',
    dayNumber: template?.dayNumber ?? 1,
    startedAt: workout.startedAt,
    completedAt: workout.completedAt,
    prsScore: workout.prsScore,
    bodyweightKg: workout.bodyweightKg,
    notes: workout.notes,
    durationMinutes,
    totalSets: sets.length,
    sets,
  };
}

export async function getWeekStats(
  startIso: string,
  endIso: string
): Promise<{ workoutsThisWeek: number; setsThisWeek: number }> {
  ensureInitialized();

  const start = parseIso(startIso);
  const end = parseIso(endIso);

  const workouts = state.workouts.filter((workout) => {
    if (!workout.completedAt) {
      return false;
    }

    const completedAt = parseIso(workout.completedAt);
    return completedAt >= start && completedAt < end;
  });

  const workoutIds = new Set(workouts.map((workout) => workout.id));
  const setsThisWeek = state.sets.filter((set) => workoutIds.has(set.workoutId)).length;

  return {
    workoutsThisWeek: workouts.length,
    setsThisWeek,
  };
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
  ensureInitialized();

  const windowStartMs = parseIso(windowStartIso);
  const windowEndMs = parseIso(windowEndIso);

  if (!Number.isFinite(windowStartMs) || !Number.isFinite(windowEndMs)) {
    throw new Error('Invalid adherence window dates.');
  }

  if (windowEndMs <= windowStartMs) {
    throw new Error('Adherence window end must be after start.');
  }

  const workouts = state.workouts
    .filter((workout) => {
      if (!workout.completedAt) {
        return false;
      }

      const startedAt = parseIso(workout.startedAt);
      return startedAt >= windowStartMs && startedAt < windowEndMs;
    })
    .slice()
    .sort((left, right) => parseIso(left.startedAt) - parseIso(right.startedAt));

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
    const startedAt = parseIso(workout.startedAt);
    const weekIndex = Math.floor((startedAt - windowStartMs) / ONE_WEEK_MS);
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
}

export async function getRecentExerciseExposures(
  exerciseId: string,
  limit = 2
): Promise<ProgressionExposure[]> {
  ensureInitialized();

  const workoutIds = new Set(
    state.sets
      .filter((set) => set.exerciseId === exerciseId)
      .map((set) => set.workoutId)
  );

  const workouts = state.workouts
    .filter(
      (workout) =>
        workout.completedAt !== null &&
        workoutIds.has(workout.id)
    )
    .slice()
    .sort((left, right) => parseIso(right.completedAt) - parseIso(left.completedAt))
    .slice(0, limit);

  return workouts.map((workout) => {
    const template =
      workout.dayTemplateId !== null
        ? findDayTemplate(workout.dayTemplateId)
        : null;

    const targetRepHigh =
      template?.slots.find(
        (slot) =>
          slot.defaultExerciseId === exerciseId ||
          slot.alternateExercises.some(
            (alternateExercise) => alternateExercise.id === exerciseId
          )
      )?.targetRepHigh ?? 10;

    const workingSets = state.sets
      .filter(
        (set) =>
          set.workoutId === workout.id &&
          set.exerciseId === exerciseId &&
          !set.isWarmup
      )
      .slice()
      .sort((left, right) => left.setOrder - right.setOrder);

    return {
      workoutId: workout.id,
      completedAt: workout.completedAt ?? workout.startedAt,
      targetRepHigh,
      workingSetReps: workingSets.map((set) => set.reps),
      topLoadKg: workingSets.reduce(
        (maxLoad, set) => Math.max(maxLoad, set.loadKg),
        0
      ),
    };
  });
}

export async function listExercises(): Promise<Array<{ id: string; name: string }>> {
  ensureInitialized();

  return state.exerciseLibrary
    .filter((exercise) => exercise.isActive)
    .map((exercise) => ({ id: exercise.id, name: exercise.name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function listExerciseLibrary(): Promise<Exercise[]> {
  ensureInitialized();

  return state.exerciseLibrary
    .map((exercise) => ({ ...exercise }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function setExerciseActive(input: {
  exerciseId: string;
  isActive: boolean;
}): Promise<void> {
  ensureInitialized();

  state.exerciseLibrary = state.exerciseLibrary.map((exercise) =>
    exercise.id === input.exerciseId
      ? { ...exercise, isActive: input.isActive }
      : exercise
  );
}

export async function insertCustomExercise(exercise: {
  id: string;
  name: string;
  category: Exercise['category'];
  equipment: Exercise['equipment'];
}): Promise<void> {
  ensureInitialized();

  state.exerciseLibrary = [
    ...state.exerciseLibrary,
    {
      id: exercise.id,
      name: exercise.name,
      category: exercise.category,
      equipment: exercise.equipment,
      isActive: true,
    },
  ];
}

export async function insertExerciseMuscleMappings(mappings: {
  exerciseId: string;
  muscleGroup: string;
  role: 'direct' | 'indirect';
}[]): Promise<void> {
  ensureInitialized();

  for (const mapping of mappings) {
    const existingIndex = state.exerciseMappings.findIndex(
      (candidate) =>
        candidate.exerciseId === mapping.exerciseId &&
        candidate.muscleGroup === mapping.muscleGroup
    );

    if (existingIndex >= 0) {
      state.exerciseMappings[existingIndex] = { ...mapping };
      continue;
    }

    state.exerciseMappings.push({ ...mapping });
  }
}

export async function addSlotAlternate(slotId: number, exerciseId: string): Promise<void> {
  ensureInitialized();

  const exercise = getExerciseById(exerciseId);
  if (!exercise) {
    return;
  }

  state.dayTemplates = state.dayTemplates.map((template) => ({
    ...template,
    slots: template.slots.map((slot) => {
      if (slot.id !== slotId) {
        return slot;
      }

      const alreadyExists = slot.alternateExercises.some(
        (alternate) => alternate.id === exerciseId
      );

      if (alreadyExists) {
        return slot;
      }

      return {
        ...slot,
        alternateExercises: [
          ...slot.alternateExercises,
          { id: exercise.id, name: exercise.name },
        ].sort((left, right) => left.name.localeCompare(right.name)),
      };
    }),
  }));
}

export async function updateCustomExerciseDefinition(input: {
  exerciseId: string;
  name: string;
  category: Exercise['category'];
}): Promise<void> {
  ensureInitialized();

  if (!input.exerciseId.startsWith('custom-')) {
    throw new Error('Only custom exercises can be edited.');
  }

  state.exerciseLibrary = state.exerciseLibrary.map((exercise) =>
    exercise.id === input.exerciseId
      ? { ...exercise, name: input.name, category: input.category }
      : exercise
  );

  state.dayTemplates = state.dayTemplates.map((template) => ({
    ...template,
    slots: template.slots.map((slot) => ({
      ...slot,
      alternateExercises: slot.alternateExercises.map((alternate) =>
        alternate.id === input.exerciseId
          ? { ...alternate, name: input.name }
          : alternate
      ),
    })),
  }));
}

export async function deleteCustomExercise(exerciseId: string): Promise<void> {
  ensureInitialized();

  if (!exerciseId.startsWith('custom-')) {
    throw new Error('Only custom exercises can be deleted.');
  }

  const hasLoggedSets = state.sets.some((set) => set.exerciseId === exerciseId);
  if (hasLoggedSets) {
    throw new Error('Cannot delete a custom exercise that already has logged sets.');
  }

  state.exerciseLibrary = state.exerciseLibrary.filter(
    (exercise) => exercise.id !== exerciseId
  );
  state.exerciseMappings = state.exerciseMappings.filter(
    (mapping) => mapping.exerciseId !== exerciseId
  );
  state.dayTemplates = state.dayTemplates.map((template) => ({
    ...template,
    slots: template.slots.map((slot) => ({
      ...slot,
      alternateExercises: slot.alternateExercises.filter(
        (alternate) => alternate.id !== exerciseId
      ),
    })),
  }));
}

export async function getStrengthTrendSeries(
  exerciseId: string
): Promise<StrengthTrendPoint[]> {
  ensureInitialized();

  const relevantSets = state.sets
    .filter((set) => {
      if (set.exerciseId !== exerciseId || set.isWarmup) {
        return false;
      }

      const workout = state.workouts.find((candidate) => candidate.id === set.workoutId);
      return Boolean(workout?.completedAt);
    })
    .slice()
    .sort((left, right) => {
      const leftWorkout = state.workouts.find((candidate) => candidate.id === left.workoutId);
      const rightWorkout = state.workouts.find((candidate) => candidate.id === right.workoutId);

      const dateDelta =
        parseIso(leftWorkout?.completedAt) - parseIso(rightWorkout?.completedAt);
      if (dateDelta !== 0) {
        return dateDelta;
      }

      const loadDelta = right.loadKg - left.loadKg;
      if (loadDelta !== 0) {
        return loadDelta;
      }

      return right.reps - left.reps;
    });

  const scoreFor = (loadKg: number, reps: number): number => loadKg * (1 + reps / 30);

  const byWorkout = new Map<string, StrengthTrendPoint>();
  for (const set of relevantSets) {
    const workout = state.workouts.find((candidate) => candidate.id === set.workoutId);
    if (!workout?.completedAt) {
      continue;
    }

    const existing = byWorkout.get(set.workoutId);
    if (!existing) {
      byWorkout.set(set.workoutId, {
        workoutId: set.workoutId,
        exerciseId: set.exerciseId,
        exerciseName: getExerciseById(set.exerciseId)?.name ?? set.exerciseId,
        completedAt: workout.completedAt,
        bestSetReps: set.reps,
        bestSetLoadKg: set.loadKg,
      });
      continue;
    }

    if (
      scoreFor(set.loadKg, set.reps) >
      scoreFor(existing.bestSetLoadKg, existing.bestSetReps)
    ) {
      byWorkout.set(set.workoutId, {
        ...existing,
        bestSetReps: set.reps,
        bestSetLoadKg: set.loadKg,
      });
    }
  }

  return Array.from(byWorkout.values()).sort(
    (left, right) => parseIso(left.completedAt) - parseIso(right.completedAt)
  );
}

export async function logBodyweight(input: {
  weightKg: number;
  loggedAt?: string;
}): Promise<void> {
  ensureInitialized();

  state.bodyweightLog.push({
    id: state.nextBodyweightId,
    workoutId: null,
    weightKg: input.weightKg,
    loggedAt: input.loggedAt ?? new Date().toISOString(),
    source: 'manual',
  });

  state.nextBodyweightId += 1;
}

export async function getBodyweightLog(
  limit = 100
): Promise<BodyweightEntry[]> {
  ensureInitialized();

  return state.bodyweightLog
    .slice()
    .sort((left, right) => parseIso(right.loggedAt) - parseIso(left.loggedAt))
    .slice(0, limit);
}

export async function exportAllData(): Promise<ExportPayload> {
  ensureInitialized();

  return {
    exportedAt: new Date().toISOString(),
    workouts: state.workouts.map((workout) => ({ ...workout })),
    sets: state.sets.map((set) => ({ ...set })),
    exercises: state.exerciseLibrary.map((exercise) => ({ ...exercise })),
    exercise_muscle_mappings: state.exerciseMappings.map((mapping) => ({
      ...mapping,
    })),
    bodyweight_log: await getBodyweightLog(10000),
  };
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

export async function restoreFromExportData(payload: ExportPayload): Promise<{
  workouts: number;
  sets: number;
  bodyweightEntries: number;
}> {
  ensureInitialized();
  assertImportPayloadShape(payload);

  state.workouts = payload.workouts.map((workout) => ({ ...workout }));
  state.sets = payload.sets.map((set) => ({ ...set }));
  state.bodyweightLog = payload.bodyweight_log.map((entry) => ({ ...entry }));

  if (payload.exercises.length > 0) {
    const byId = new Map(state.exerciseLibrary.map((exercise) => [exercise.id, exercise]));
    for (const importedExercise of payload.exercises) {
      byId.set(importedExercise.id, { ...importedExercise });
    }

    state.exerciseLibrary = Array.from(byId.values());
  }

  if (payload.exercise_muscle_mappings.length > 0) {
    state.exerciseMappings = payload.exercise_muscle_mappings.map((mapping) => ({
      ...mapping,
    }));
  }

  const maxSetId = state.sets.reduce((maxId, set) => Math.max(maxId, set.id), 0);
  const maxBodyweightId = state.bodyweightLog.reduce(
    (maxId, entry) => Math.max(maxId, entry.id),
    0
  );
  state.nextSetId = maxSetId + 1;
  state.nextBodyweightId = maxBodyweightId + 1;

  const anchor = getEarliestCompletedWorkoutStartedAt();
  if (anchor) {
    state.appSettings.set(APP_SETTING_FIRST_WORKOUT_ANCHOR, anchor);
  } else {
    state.appSettings.delete(APP_SETTING_FIRST_WORKOUT_ANCHOR);
  }

  return {
    workouts: state.workouts.length,
    sets: state.sets.length,
    bodyweightEntries: state.bodyweightLog.length,
  };
}

export async function getFirstWorkoutAnchor(): Promise<string | null> {
  ensureInitialized();
  const persisted = state.appSettings.get(APP_SETTING_FIRST_WORKOUT_ANCHOR) ?? null;
  const inferred = getEarliestCompletedWorkoutStartedAt();
  if (!inferred) {
    if (persisted) {
      state.appSettings.delete(APP_SETTING_FIRST_WORKOUT_ANCHOR);
    }
    return null;
  }

  if (persisted !== inferred) {
    state.appSettings.set(APP_SETTING_FIRST_WORKOUT_ANCHOR, inferred);
  }

  return inferred;
}
