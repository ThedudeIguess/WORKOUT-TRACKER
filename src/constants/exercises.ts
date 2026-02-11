import {
  type Exercise,
  type ExerciseMuscleMapping,
} from '../types';

export const exercises: Exercise[] = [
  { id: 'broad-jumps', name: 'Broad Jumps', category: 'metcon', equipment: 'bodyweight', isActive: true },
  { id: 'barbell-back-squat', name: 'Barbell Back Squat', category: 'compound', equipment: 'barbell', isActive: true },
  { id: 'seated-leg-curl', name: 'Seated Leg Curl', category: 'isolation', equipment: 'machine', isActive: true },
  { id: 'ghd-raise', name: 'GHD Raise', category: 'isolation', equipment: 'machine', isActive: true },
  { id: 'hanging-knee-raise', name: 'Hanging Knee Raise', category: 'isolation', equipment: 'bodyweight', isActive: true },
  { id: 'wall-hip-flexor-stretch', name: 'Wall Hip Flexor Stretch', category: 'mobility', equipment: 'bodyweight', isActive: true },
  { id: 'barbell-bench-press', name: 'Barbell Bench Press', category: 'compound', equipment: 'barbell', isActive: true },
  { id: 'assisted-dips', name: 'Assisted Dips', category: 'compound', equipment: 'assisted', isActive: true },
  { id: 'cable-lateral-raise', name: 'Cable Lateral Raise', category: 'isolation', equipment: 'cable', isActive: true },
  { id: 'preacher-curl-ez', name: 'Preacher Curl (EZ)', category: 'isolation', equipment: 'barbell', isActive: true },
  { id: 'spider-curl', name: 'Spider Curl', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'dead-hang-passive', name: 'Dead Hang (Passive)', category: 'mobility', equipment: 'bodyweight', isActive: true },
  { id: 'rack-assisted-chin-up', name: 'Rack/Assisted Chin-Up', category: 'compound', equipment: 'assisted', isActive: true },
  { id: 'seated-cable-row', name: 'Seated Cable Row', category: 'compound', equipment: 'cable', isActive: true },
  { id: 'machine-row', name: 'Machine Row', category: 'compound', equipment: 'machine', isActive: true },
  { id: 'cable-y-raise', name: 'Cable Y-Raise', category: 'isolation', equipment: 'cable', isActive: true },
  { id: 'triceps-extension-cable', name: 'Triceps Extension', category: 'isolation', equipment: 'cable', isActive: true },
  { id: 'box-step-overs', name: 'Box Step-Overs', category: 'metcon', equipment: 'bodyweight', isActive: true },
  { id: 'ql-walk-carry', name: 'QL Walk (Carry)', category: 'metcon', equipment: 'mixed', isActive: true },
  { id: 'bss-hops', name: 'BSS Hops', category: 'metcon', equipment: 'bodyweight', isActive: true },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', category: 'compound', equipment: 'dumbbell', isActive: true },
  { id: 'single-leg-stiff-leg-deadlift', name: 'Single-Leg Stiff-Leg Deadlift', category: 'compound', equipment: 'dumbbell', isActive: true },
  { id: 'leg-extension', name: 'Leg Extension', category: 'isolation', equipment: 'machine', isActive: true },
  { id: 'mobility-metcon', name: 'Mobility MetCon', category: 'mobility', equipment: 'bodyweight', isActive: true },
  { id: 'db-incline-press', name: 'DB Incline Press', category: 'compound', equipment: 'dumbbell', isActive: true },
  { id: 'cable-crossover', name: 'Cable Crossover', category: 'isolation', equipment: 'cable', isActive: true },
  { id: 'side-lying-lateral-raise', name: 'Side-Lying Lateral Raise', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'barbell-curl', name: 'Barbell Curl', category: 'isolation', equipment: 'barbell', isActive: true },
  { id: 'dumbbell-curl', name: 'Dumbbell Curl', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'lat-pulldown', name: 'Lat Pulldown', category: 'compound', equipment: 'machine', isActive: true },
  { id: 'inverted-row', name: 'Inverted Row', category: 'compound', equipment: 'bodyweight', isActive: true },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'hill-sprints', name: 'Hill Sprints', category: 'metcon', equipment: 'bodyweight', isActive: true },
];

export const exerciseMuscleMappings: ExerciseMuscleMapping[] = [
  { exerciseId: 'broad-jumps', muscleGroup: 'quads', role: 'direct' },
  { exerciseId: 'broad-jumps', muscleGroup: 'glutes', role: 'direct' },

  { exerciseId: 'barbell-back-squat', muscleGroup: 'quads', role: 'direct' },
  { exerciseId: 'barbell-back-squat', muscleGroup: 'glutes', role: 'direct' },

  { exerciseId: 'seated-leg-curl', muscleGroup: 'hamstrings', role: 'direct' },

  { exerciseId: 'ghd-raise', muscleGroup: 'abs', role: 'direct' },
  { exerciseId: 'hanging-knee-raise', muscleGroup: 'abs', role: 'direct' },

  { exerciseId: 'barbell-bench-press', muscleGroup: 'chest', role: 'direct' },
  { exerciseId: 'barbell-bench-press', muscleGroup: 'triceps', role: 'indirect' },
  { exerciseId: 'barbell-bench-press', muscleGroup: 'front-delts', role: 'indirect' },

  { exerciseId: 'assisted-dips', muscleGroup: 'triceps', role: 'direct' },
  { exerciseId: 'assisted-dips', muscleGroup: 'chest', role: 'direct' },

  { exerciseId: 'cable-lateral-raise', muscleGroup: 'side-delts', role: 'direct' },

  { exerciseId: 'preacher-curl-ez', muscleGroup: 'biceps', role: 'direct' },
  { exerciseId: 'spider-curl', muscleGroup: 'biceps', role: 'direct' },
  { exerciseId: 'barbell-curl', muscleGroup: 'biceps', role: 'direct' },
  { exerciseId: 'dumbbell-curl', muscleGroup: 'biceps', role: 'direct' },

  { exerciseId: 'dead-hang-passive', muscleGroup: 'forearms', role: 'direct' },

  { exerciseId: 'rack-assisted-chin-up', muscleGroup: 'lats', role: 'direct' },
  { exerciseId: 'rack-assisted-chin-up', muscleGroup: 'biceps', role: 'indirect' },

  { exerciseId: 'seated-cable-row', muscleGroup: 'upper-back', role: 'direct' },
  { exerciseId: 'seated-cable-row', muscleGroup: 'lats', role: 'indirect' },
  { exerciseId: 'seated-cable-row', muscleGroup: 'biceps', role: 'indirect' },

  { exerciseId: 'machine-row', muscleGroup: 'upper-back', role: 'direct' },
  { exerciseId: 'machine-row', muscleGroup: 'lats', role: 'indirect' },
  { exerciseId: 'machine-row', muscleGroup: 'biceps', role: 'indirect' },

  { exerciseId: 'cable-y-raise', muscleGroup: 'lower-traps', role: 'direct' },
  { exerciseId: 'cable-y-raise', muscleGroup: 'rear-delts', role: 'direct' },

  { exerciseId: 'triceps-extension-cable', muscleGroup: 'triceps', role: 'direct' },

  { exerciseId: 'box-step-overs', muscleGroup: 'quads', role: 'direct' },
  { exerciseId: 'box-step-overs', muscleGroup: 'glutes', role: 'direct' },

  { exerciseId: 'ql-walk-carry', muscleGroup: 'obliques', role: 'direct' },
  { exerciseId: 'ql-walk-carry', muscleGroup: 'forearms', role: 'direct' },

  { exerciseId: 'bss-hops', muscleGroup: 'quads', role: 'direct' },
  { exerciseId: 'bss-hops', muscleGroup: 'glutes', role: 'direct' },

  { exerciseId: 'bulgarian-split-squat', muscleGroup: 'quads', role: 'direct' },
  { exerciseId: 'bulgarian-split-squat', muscleGroup: 'glutes', role: 'direct' },

  { exerciseId: 'single-leg-stiff-leg-deadlift', muscleGroup: 'hamstrings', role: 'direct' },
  { exerciseId: 'single-leg-stiff-leg-deadlift', muscleGroup: 'glutes', role: 'direct' },

  { exerciseId: 'leg-extension', muscleGroup: 'quads', role: 'direct' },

  { exerciseId: 'db-incline-press', muscleGroup: 'chest', role: 'direct' },
  { exerciseId: 'db-incline-press', muscleGroup: 'triceps', role: 'indirect' },
  { exerciseId: 'db-incline-press', muscleGroup: 'front-delts', role: 'indirect' },

  { exerciseId: 'cable-crossover', muscleGroup: 'chest', role: 'direct' },

  { exerciseId: 'side-lying-lateral-raise', muscleGroup: 'side-delts', role: 'direct' },

  { exerciseId: 'lat-pulldown', muscleGroup: 'lats', role: 'direct' },
  { exerciseId: 'lat-pulldown', muscleGroup: 'biceps', role: 'indirect' },

  { exerciseId: 'inverted-row', muscleGroup: 'upper-back', role: 'direct' },
  { exerciseId: 'inverted-row', muscleGroup: 'biceps', role: 'indirect' },
  { exerciseId: 'inverted-row', muscleGroup: 'lats', role: 'indirect' },

  { exerciseId: 'rear-delt-fly', muscleGroup: 'rear-delts', role: 'direct' },
  { exerciseId: 'rear-delt-fly', muscleGroup: 'upper-back', role: 'indirect' },

  { exerciseId: 'hill-sprints', muscleGroup: 'glutes', role: 'direct' },
  { exerciseId: 'hill-sprints', muscleGroup: 'hamstrings', role: 'direct' },
];

export const metconDiscounts: Record<string, number> = {
  'broad-jumps': 0.1,
  'bss-hops': 0.1,
  'box-step-overs': 0.35,
  'hill-sprints': 0.2,
  'ql-walk-carry': 0.3,
};

export const excludedFromDefaultHypertrophyVolume = new Set<string>([
  'dead-hang-passive',
]);
