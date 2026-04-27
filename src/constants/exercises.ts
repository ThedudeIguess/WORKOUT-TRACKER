import {
  type Exercise,
  type ExerciseMuscleMapping,
} from '../types';

export const exercises: Exercise[] = [
  // --- Original library (preserved for historical session compatibility) ---
  { id: 'broad-jumps', name: 'Broad Jumps', category: 'metcon', equipment: 'bodyweight', isActive: true },
  { id: 'barbell-back-squat', name: 'Barbell Squat', category: 'compound', equipment: 'barbell', isActive: true },
  { id: 'seated-leg-curl', name: 'Seated Leg Curl', category: 'isolation', equipment: 'machine', isActive: true },
  { id: 'ghd-raise', name: 'GHD Sit Up', category: 'isolation', equipment: 'machine', isActive: true },
  { id: 'hyperextension-glute', name: '45 Degree Hyperextension (Glute Focus)', category: 'isolation', equipment: 'machine', isActive: true },
  { id: 'hanging-knee-raise', name: 'Hanging Knee Raise', category: 'isolation', equipment: 'bodyweight', isActive: true },
  { id: 'wall-hip-flexor-stretch', name: 'Wall Reference Hip Flexor Stretch', category: 'mobility', equipment: 'bodyweight', isActive: true },
  { id: 'barbell-bench-press', name: 'Barbell Bench Press', category: 'compound', equipment: 'barbell', isActive: true },
  { id: 'assisted-dips', name: 'Assisted Dips', category: 'compound', equipment: 'assisted', isActive: true },
  { id: 'cable-lateral-raise', name: 'Cable Lateral Raise', category: 'isolation', equipment: 'cable', isActive: true },
  { id: 'preacher-curl-ez', name: 'Preacher Curl (EZ)', category: 'isolation', equipment: 'barbell', isActive: true },
  { id: 'spider-curl', name: 'Spider Curl', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'dead-hang-passive', name: 'Dead Hang (Passive)', category: 'mobility', equipment: 'bodyweight', isActive: true },
  { id: 'rack-assisted-chin-up', name: 'Chin Up', category: 'compound', equipment: 'assisted', isActive: true },
  { id: 'seated-cable-row', name: 'Seated Cable Row', category: 'compound', equipment: 'cable', isActive: true },
  { id: 'machine-row', name: 'Machine Row', category: 'compound', equipment: 'machine', isActive: true },
  { id: 'cable-y-raise', name: 'Cable Y-Raise', category: 'isolation', equipment: 'cable', isActive: true },
  { id: 'triceps-extension-cable', name: 'Cable Triceps Extension', category: 'isolation', equipment: 'cable', isActive: true },
  { id: 'box-step-overs', name: 'Box Step-Overs', category: 'metcon', equipment: 'bodyweight', isActive: true },
  { id: 'ql-walk-carry', name: 'QL Walk (Carry)', category: 'metcon', equipment: 'mixed', isActive: true },
  { id: 'bss-hops', name: 'Bulgarian Hops', category: 'metcon', equipment: 'bodyweight', isActive: true },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', category: 'compound', equipment: 'dumbbell', isActive: true },
  { id: 'single-leg-stiff-leg-deadlift', name: 'Single-Leg Stiff-Leg Deadlift', category: 'compound', equipment: 'dumbbell', isActive: true },
  { id: 'leg-extension', name: 'Leg Extension', category: 'isolation', equipment: 'machine', isActive: true },
  { id: 'mobility-metcon', name: 'Mobility MetCon', category: 'mobility', equipment: 'bodyweight', isActive: true },
  { id: 'db-incline-press', name: 'Dumbbell Incline Press', category: 'compound', equipment: 'dumbbell', isActive: true },
  { id: 'cable-crossover', name: 'Cable Crossover', category: 'isolation', equipment: 'cable', isActive: true },
  { id: 'side-lying-lateral-raise', name: 'Side-Lying Lateral Raise', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'barbell-curl', name: 'Barbell Curl', category: 'isolation', equipment: 'barbell', isActive: true },
  { id: 'dumbbell-curl', name: 'Dumbbell Curl', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'lat-pulldown', name: 'Lat Pulldown', category: 'compound', equipment: 'machine', isActive: true },
  { id: 'inverted-row', name: 'Inverted Row', category: 'compound', equipment: 'bodyweight', isActive: true },
  { id: 'rear-delt-fly', name: 'Cable Rear Delt Fly', category: 'isolation', equipment: 'cable', isActive: true },
  { id: 'hill-sprints', name: 'Hill Sprints', category: 'metcon', equipment: 'bodyweight', isActive: true },

  // --- Phase 1 additions ---
  { id: 'lying-leg-curl', name: 'Lying Leg Curl', category: 'isolation', equipment: 'machine', isActive: true },
  { id: 'cable-crucifix-raise', name: 'Cable Crucifix Raise', category: 'isolation', equipment: 'cable', isActive: true },
  { id: 'chest-dip', name: 'Chest Dip', category: 'compound', equipment: 'bodyweight', isActive: true },
  { id: 'dumbbell-y-raise', name: 'Dumbbell Y-Raise', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'jm-press', name: 'JM Press', category: 'compound', equipment: 'barbell', isActive: true },
  { id: 'metcon-circuit', name: 'Metcon Circuit', category: 'metcon', equipment: 'mixed', isActive: true },
  { id: 'stiff-leg-deadlift', name: 'Stiff Leg Deadlift', category: 'compound', equipment: 'barbell', isActive: true },
  { id: 'reverse-nordic', name: 'Reverse Nordic', category: 'isolation', equipment: 'bodyweight', isActive: true },
  { id: 'side-lying-compound-raise', name: 'Side Lying Compound Raise', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'lying-cable-curl-pronated', name: 'Lying Cable Curl (Pronated Grip)', category: 'isolation', equipment: 'cable', isActive: true },

  // --- Phase 2 additions ---
  { id: 'horse-stance-hold', name: 'Horse Stance Hold', category: 'isolation', equipment: 'bodyweight', isActive: true },
  { id: 'overhead-lateral-raise', name: 'Overhead Lateral Raise', category: 'isolation', equipment: 'cable', isActive: true },
  { id: 'triceps-pushdown', name: 'Triceps Pushdown', category: 'isolation', equipment: 'cable', isActive: true },
  { id: 'sissy-squat', name: 'Sissy Squat', category: 'isolation', equipment: 'bodyweight', isActive: true },
  { id: 'sled-push', name: 'Sled Push', category: 'metcon', equipment: 'mixed', isActive: true },
  { id: 'smith-machine-incline-press', name: 'Smith Machine Incline Press', category: 'compound', equipment: 'machine', isActive: true },
  { id: 'incline-dumbbell-fly', name: 'Incline Dumbbell Fly', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'zottman-curl', name: 'Zottman Curl', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'incline-hammer-curl', name: 'Incline Hammer Curl', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'single-arm-lat-pulldown', name: 'Single-Arm Lat Pulldown', category: 'compound', equipment: 'cable', isActive: true },
  { id: 'dumbbell-rear-delt-fly', name: 'Dumbbell Rear Delt Fly', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'incline-skullcrusher', name: 'Incline Skullcrusher', category: 'isolation', equipment: 'barbell', isActive: true },

  // --- Phase 3 additions ---
  { id: 'rocker-broad-jump', name: 'Rocker Broad Jump', category: 'metcon', equipment: 'bodyweight', isActive: true },
  { id: 'single-leg-lying-leg-curl', name: 'Single-Leg Lying Leg Curl', category: 'isolation', equipment: 'machine', isActive: true },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', category: 'isolation', equipment: 'bodyweight', isActive: true },
  { id: 'dual-elevated-hip-thrust', name: 'Dual Elevated Hip Thrust', category: 'compound', equipment: 'barbell', isActive: true },
  { id: 'barbell-overhead-press', name: 'Barbell Overhead Press', category: 'compound', equipment: 'barbell', isActive: true },
  { id: 'incline-trap-3-raise', name: 'Incline Trap 3 Raise', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'pendlay-row', name: 'Pendlay Row', category: 'compound', equipment: 'barbell', isActive: true },
  { id: 'dumbbell-lateral-raise', name: 'Dumbbell Lateral Raise', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'triceps-overhead-extension', name: 'Triceps Overhead Extension', category: 'isolation', equipment: 'dumbbell', isActive: true },
  { id: 'single-db-muscle-snatch', name: 'Single DB Muscle Snatch', category: 'compound', equipment: 'dumbbell', isActive: true },
  { id: 'feet-elevated-shoulder-taps', name: 'Feet Elevated Shoulder Taps', category: 'isolation', equipment: 'bodyweight', isActive: true },
  { id: 'cable-glute-kickback', name: 'Cable Glute Kickback', category: 'isolation', equipment: 'cable', isActive: true },
  { id: 'copenhagen-plank', name: 'Copenhagen Plank', category: 'isolation', equipment: 'bodyweight', isActive: true },
  { id: 'cable-chest-press', name: 'Cable Chest Press', category: 'compound', equipment: 'cable', isActive: true },
  { id: 'cable-curl', name: 'Cable Curl', category: 'isolation', equipment: 'cable', isActive: true },
  { id: 'single-arm-eagle-grip-hang', name: 'Single Arm Eagle Grip Hang', category: 'mobility', equipment: 'bodyweight', isActive: true },
  { id: 'triceps-dip', name: 'Triceps Dip', category: 'compound', equipment: 'bodyweight', isActive: true },
];

export const exerciseMuscleMappings: ExerciseMuscleMapping[] = [
  // --- Original mappings (preserved) ---
  { exerciseId: 'broad-jumps', muscleGroup: 'quads', role: 'direct' },
  { exerciseId: 'broad-jumps', muscleGroup: 'glutes', role: 'direct' },

  { exerciseId: 'barbell-back-squat', muscleGroup: 'quads', role: 'direct' },
  { exerciseId: 'barbell-back-squat', muscleGroup: 'glutes', role: 'direct' },

  { exerciseId: 'seated-leg-curl', muscleGroup: 'hamstrings', role: 'direct' },

  { exerciseId: 'ghd-raise', muscleGroup: 'abs', role: 'direct' },
  { exerciseId: 'hyperextension-glute', muscleGroup: 'glutes', role: 'direct' },
  { exerciseId: 'hyperextension-glute', muscleGroup: 'hamstrings', role: 'indirect' },
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

  // --- Phase 1 mappings ---
  { exerciseId: 'lying-leg-curl', muscleGroup: 'hamstrings', role: 'direct' },

  { exerciseId: 'cable-crucifix-raise', muscleGroup: 'chest', role: 'direct' },
  { exerciseId: 'cable-crucifix-raise', muscleGroup: 'front-delts', role: 'indirect' },

  { exerciseId: 'chest-dip', muscleGroup: 'chest', role: 'direct' },
  { exerciseId: 'chest-dip', muscleGroup: 'triceps', role: 'direct' },
  { exerciseId: 'chest-dip', muscleGroup: 'front-delts', role: 'indirect' },

  { exerciseId: 'dumbbell-y-raise', muscleGroup: 'lower-traps', role: 'direct' },
  { exerciseId: 'dumbbell-y-raise', muscleGroup: 'rear-delts', role: 'direct' },

  { exerciseId: 'jm-press', muscleGroup: 'triceps', role: 'direct' },
  { exerciseId: 'jm-press', muscleGroup: 'chest', role: 'indirect' },

  // metcon-circuit: no direct hypertrophy mapping (catch-all metcon, contributes via metconDiscount)

  { exerciseId: 'stiff-leg-deadlift', muscleGroup: 'hamstrings', role: 'direct' },
  { exerciseId: 'stiff-leg-deadlift', muscleGroup: 'glutes', role: 'direct' },

  { exerciseId: 'reverse-nordic', muscleGroup: 'quads', role: 'direct' },

  { exerciseId: 'side-lying-compound-raise', muscleGroup: 'side-delts', role: 'direct' },
  { exerciseId: 'side-lying-compound-raise', muscleGroup: 'front-delts', role: 'indirect' },

  { exerciseId: 'lying-cable-curl-pronated', muscleGroup: 'forearms', role: 'direct' },
  { exerciseId: 'lying-cable-curl-pronated', muscleGroup: 'biceps', role: 'indirect' },

  // --- Phase 2 mappings ---
  { exerciseId: 'horse-stance-hold', muscleGroup: 'abs', role: 'direct' },
  { exerciseId: 'horse-stance-hold', muscleGroup: 'obliques', role: 'direct' },

  { exerciseId: 'overhead-lateral-raise', muscleGroup: 'side-delts', role: 'direct' },

  { exerciseId: 'triceps-pushdown', muscleGroup: 'triceps', role: 'direct' },

  { exerciseId: 'sissy-squat', muscleGroup: 'quads', role: 'direct' },

  { exerciseId: 'sled-push', muscleGroup: 'quads', role: 'direct' },
  { exerciseId: 'sled-push', muscleGroup: 'glutes', role: 'direct' },
  { exerciseId: 'sled-push', muscleGroup: 'hamstrings', role: 'indirect' },

  { exerciseId: 'smith-machine-incline-press', muscleGroup: 'chest', role: 'direct' },
  { exerciseId: 'smith-machine-incline-press', muscleGroup: 'front-delts', role: 'indirect' },
  { exerciseId: 'smith-machine-incline-press', muscleGroup: 'triceps', role: 'indirect' },

  { exerciseId: 'incline-dumbbell-fly', muscleGroup: 'chest', role: 'direct' },
  { exerciseId: 'incline-dumbbell-fly', muscleGroup: 'front-delts', role: 'indirect' },

  { exerciseId: 'zottman-curl', muscleGroup: 'biceps', role: 'direct' },
  { exerciseId: 'zottman-curl', muscleGroup: 'forearms', role: 'indirect' },

  { exerciseId: 'incline-hammer-curl', muscleGroup: 'biceps', role: 'direct' },
  { exerciseId: 'incline-hammer-curl', muscleGroup: 'forearms', role: 'indirect' },

  { exerciseId: 'single-arm-lat-pulldown', muscleGroup: 'lats', role: 'direct' },
  { exerciseId: 'single-arm-lat-pulldown', muscleGroup: 'biceps', role: 'indirect' },

  { exerciseId: 'dumbbell-rear-delt-fly', muscleGroup: 'rear-delts', role: 'direct' },
  { exerciseId: 'dumbbell-rear-delt-fly', muscleGroup: 'upper-back', role: 'indirect' },

  { exerciseId: 'incline-skullcrusher', muscleGroup: 'triceps', role: 'direct' },

  // --- Phase 3 mappings ---
  { exerciseId: 'rocker-broad-jump', muscleGroup: 'quads', role: 'direct' },
  { exerciseId: 'rocker-broad-jump', muscleGroup: 'glutes', role: 'direct' },

  { exerciseId: 'single-leg-lying-leg-curl', muscleGroup: 'hamstrings', role: 'direct' },

  { exerciseId: 'hanging-leg-raise', muscleGroup: 'abs', role: 'direct' },

  { exerciseId: 'dual-elevated-hip-thrust', muscleGroup: 'glutes', role: 'direct' },
  { exerciseId: 'dual-elevated-hip-thrust', muscleGroup: 'hamstrings', role: 'indirect' },

  { exerciseId: 'barbell-overhead-press', muscleGroup: 'front-delts', role: 'direct' },
  { exerciseId: 'barbell-overhead-press', muscleGroup: 'side-delts', role: 'indirect' },
  { exerciseId: 'barbell-overhead-press', muscleGroup: 'triceps', role: 'indirect' },

  { exerciseId: 'incline-trap-3-raise', muscleGroup: 'lower-traps', role: 'direct' },
  { exerciseId: 'incline-trap-3-raise', muscleGroup: 'rear-delts', role: 'indirect' },

  { exerciseId: 'pendlay-row', muscleGroup: 'upper-back', role: 'direct' },
  { exerciseId: 'pendlay-row', muscleGroup: 'lats', role: 'indirect' },
  { exerciseId: 'pendlay-row', muscleGroup: 'biceps', role: 'indirect' },

  { exerciseId: 'dumbbell-lateral-raise', muscleGroup: 'side-delts', role: 'direct' },

  { exerciseId: 'triceps-overhead-extension', muscleGroup: 'triceps', role: 'direct' },

  { exerciseId: 'single-db-muscle-snatch', muscleGroup: 'rear-delts', role: 'direct' },
  { exerciseId: 'single-db-muscle-snatch', muscleGroup: 'upper-back', role: 'direct' },

  { exerciseId: 'feet-elevated-shoulder-taps', muscleGroup: 'abs', role: 'direct' },
  { exerciseId: 'feet-elevated-shoulder-taps', muscleGroup: 'front-delts', role: 'indirect' },

  { exerciseId: 'cable-glute-kickback', muscleGroup: 'glutes', role: 'direct' },

  { exerciseId: 'copenhagen-plank', muscleGroup: 'obliques', role: 'direct' },
  { exerciseId: 'copenhagen-plank', muscleGroup: 'abs', role: 'indirect' },

  { exerciseId: 'cable-chest-press', muscleGroup: 'chest', role: 'direct' },
  { exerciseId: 'cable-chest-press', muscleGroup: 'front-delts', role: 'indirect' },
  { exerciseId: 'cable-chest-press', muscleGroup: 'triceps', role: 'indirect' },

  { exerciseId: 'cable-curl', muscleGroup: 'biceps', role: 'direct' },

  { exerciseId: 'single-arm-eagle-grip-hang', muscleGroup: 'forearms', role: 'direct' },
  { exerciseId: 'single-arm-eagle-grip-hang', muscleGroup: 'lats', role: 'indirect' },

  { exerciseId: 'triceps-dip', muscleGroup: 'triceps', role: 'direct' },
  { exerciseId: 'triceps-dip', muscleGroup: 'chest', role: 'indirect' },
];

export const metconDiscounts: Record<string, number> = {
  'broad-jumps': 0.1,
  'rocker-broad-jump': 0.1,
  'bss-hops': 0.1,
  'box-step-overs': 0.35,
  'hill-sprints': 0.2,
  'ql-walk-carry': 0.3,
  'sled-push': 0.35,
  'metcon-circuit': 0.35,
};

export const excludedFromDefaultHypertrophyVolume = new Set<string>([
  'dead-hang-passive',
  'single-arm-eagle-grip-hang',
]);
