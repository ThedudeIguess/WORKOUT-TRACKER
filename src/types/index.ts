export type ExerciseCategory = 'compound' | 'isolation' | 'metcon' | 'mobility';

export type ExerciseEquipment =
  | 'barbell'
  | 'cable'
  | 'dumbbell'
  | 'machine'
  | 'bodyweight'
  | 'assisted'
  | 'mixed';

export type EffortLabel = 'easy' | 'productive' | 'hard' | 'failure';

export type MuscleRole = 'direct' | 'indirect';

export type VolumeZone = 'RED' | 'YELLOW' | 'GREEN' | 'AMBER' | 'ORANGE';

export type EvidenceGrade = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  equipment: ExerciseEquipment | null;
  isActive: boolean;
}

export interface ExerciseMuscleMapping {
  exerciseId: string;
  muscleGroup: string;
  role: MuscleRole;
}

export interface MuscleGroup {
  id: string;
  displayName: string;
  sizeCategory: 'large' | 'small';
  mevLow: number;
  mevHigh: number;
  optimalLow: number;
  optimalHigh: number;
  mrvLow: number;
  mrvHigh: number;
  evidenceGrade: EvidenceGrade;
}

export interface Program {
  id: string;
  name: string;
  isActive: boolean;
}

export interface ProgramPhase {
  id: string;
  programId: string;
  name: string;
  phaseOrder: number;
  isActive: boolean;
}

export interface DayTemplate {
  id: number;
  phaseId: string;
  dayNumber: number;
  dayName: string;
}

export interface TemplateExerciseSlot {
  id: number;
  dayTemplateId: number;
  slotOrder: number;
  defaultExerciseId: string;
  inputMode: 'reps' | 'timed';
  targetSets: number;
  targetRepLow: number;
  targetRepHigh: number;
  restSeconds: number | null;
  notes: string | null;
}

export interface Workout {
  id: string;
  phaseId: string | null;
  dayTemplateId: number | null;
  startedAt: string;
  completedAt: string | null;
  prsScore: number | null;
  bodyweightKg: number | null;
  notes: string | null;
}

export interface LoggedSet {
  id: number;
  workoutId: string;
  exerciseId: string;
  setOrder: number;
  reps: number;
  loadKg: number;
  effortLabel: EffortLabel;
  isWarmup: boolean;
  loggedAt: string;
  notes: string | null;
}

export interface BodyweightEntry {
  id: number;
  workoutId: string | null;
  weightKg: number;
  loggedAt: string;
  source: 'workout' | 'manual';
}

export interface SlotExerciseOption {
  id: string;
  name: string;
}

export interface DayTemplateSlotWithOptions {
  id: number;
  dayTemplateId: number;
  slotOrder: number;
  defaultExerciseId: string;
  defaultExerciseName: string;
  inputMode: 'reps' | 'timed';
  targetSets: number;
  targetRepLow: number;
  targetRepHigh: number;
  restSeconds: number;
  notes: string | null;
  alternateExercises: SlotExerciseOption[];
}

export interface DayTemplateWithSlots {
  id: number;
  phaseId: string;
  dayNumber: number;
  dayName: string;
  slots: DayTemplateSlotWithOptions[];
}

export interface ActiveWorkoutSummary {
  workoutId: string;
  dayTemplateId: number;
  dayNumber: number;
  dayName: string;
  startedAt: string;
}

export interface WorkoutHistoryItem {
  workoutId: string;
  dayName: string;
  dayNumber: number;
  startedAt: string;
  completedAt: string;
  prsScore: number | null;
  durationMinutes: number;
  totalSets: number;
  exerciseSummary?: string;
}

export interface WorkoutDetailSet {
  id: number;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  exerciseCategory: ExerciseCategory;
  setOrder: number;
  reps: number;
  loadKg: number;
  effortLabel: EffortLabel;
  isWarmup: boolean;
  loggedAt: string;
  notes: string | null;
}

export interface WorkoutDetail {
  workoutId: string;
  dayName: string;
  dayNumber: number;
  startedAt: string;
  completedAt: string | null;
  prsScore: number | null;
  bodyweightKg: number | null;
  notes: string | null;
  durationMinutes: number;
  totalSets: number;
  sets: WorkoutDetailSet[];
}

export interface SetForVolume {
  setId: number;
  exerciseId: string;
  exerciseName: string;
  category: ExerciseCategory;
  reps: number;
  loadKg: number;
  effortLabel: EffortLabel;
  isWarmup: boolean;
  loggedAt: string;
  mappings: {
    muscleGroup: string;
    role: MuscleRole;
  }[];
}

export interface MuscleVolumeResult {
  muscleGroupId: string;
  displayName: string;
  effectiveSets: number;
  zone: VolumeZone;
  thresholds: {
    mevLow: number;
    mevHigh: number;
    optimalLow: number;
    optimalHigh: number;
    mrvLow: number;
    mrvHigh: number;
  };
}

export interface ProgressionExposure {
  workoutId: string;
  completedAt: string;
  targetRepHigh: number;
  workingSetReps: number[];
  topLoadKg: number;
}

export interface ProgressionSuggestion {
  exerciseId: string;
  suggestedLoadKg: number;
  increasePercent: number;
  reason: string;
}

export interface RollingWeekWindow {
  weekNumber: number;
  startIso: string;
  endIso: string;
}

export interface StrengthTrendPoint {
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  completedAt: string;
  bestSetReps: number;
  bestSetLoadKg: number;
}

export interface ProgressionRateResult {
  exerciseId: string;
  actualRateKgPerWeek: number;
  weeksOfData: number;
  sessionCount: number;
  referenceRateKgPerWeek: number | null;
  referenceCaveat: string | null;
  referenceLabel: string | null;
  hasEnoughData: boolean;
}

export interface TrainingPhaseInfo {
  phase: 'neural' | 'transition' | 'hypertrophic';
  title: string;
  description: string;
  citation: string;
}

export interface ExportPayload {
  exportedAt: string;
  workouts: Workout[];
  sets: LoggedSet[];
  exercises: Exercise[];
  exercise_muscle_mappings: ExerciseMuscleMapping[];
  bodyweight_log: BodyweightEntry[];
}
