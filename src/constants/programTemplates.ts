import type { DayTemplateWithSlots } from '../types';

export const HYBRID_PROGRAM_ID = 'hybrid-bb-2';
export const HYBRID_PHASE_1_ID = 'hybrid-bb-2-phase-1';

export interface SeedProgramSlot {
  slotOrder: number;
  defaultExerciseId: string;
  inputMode?: 'reps' | 'timed';
  targetSets: number;
  targetRepLow: number;
  targetRepHigh: number;
  restSeconds: number;
  notes?: string;
  alternateExerciseIds?: string[];
}

export interface SeedProgramDay {
  dayNumber: number;
  dayName: string;
  slots: SeedProgramSlot[];
}

const STRENGTH_DEFAULT = {
  targetSets: 2,
  targetRepLow: 6,
  targetRepHigh: 10,
  restSeconds: 90,
};

const ACCESSORY_DEFAULT = {
  targetSets: 2,
  targetRepLow: 10,
  targetRepHigh: 15,
  restSeconds: 75,
};

export const phaseOneProgramDays: SeedProgramDay[] = [
  {
    dayNumber: 1,
    dayName: 'Lower A',
    slots: [
      {
        slotOrder: 1,
        defaultExerciseId: 'broad-jumps',
        targetSets: 3,
        targetRepLow: 5,
        targetRepHigh: 5,
        restSeconds: 90,
        notes: 'Explosive intent, reset each rep.',
      },
      {
        slotOrder: 2,
        defaultExerciseId: 'barbell-back-squat',
        ...STRENGTH_DEFAULT,
      },
      {
        slotOrder: 3,
        defaultExerciseId: 'seated-leg-curl',
        ...ACCESSORY_DEFAULT,
      },
      {
        slotOrder: 4,
        defaultExerciseId: 'ghd-raise',
        ...ACCESSORY_DEFAULT,
        alternateExerciseIds: ['hanging-knee-raise', 'hyperextension-glute'],
      },
      {
        slotOrder: 5,
        defaultExerciseId: 'wall-hip-flexor-stretch',
        inputMode: 'timed',
        targetSets: 2,
        targetRepLow: 1,
        targetRepHigh: 1,
        restSeconds: 30,
        notes: 'Mobility hold 30-60s per side.',
      },
    ],
  },
  {
    dayNumber: 2,
    dayName: 'Upper Push A',
    slots: [
      {
        slotOrder: 1,
        defaultExerciseId: 'barbell-bench-press',
        ...STRENGTH_DEFAULT,
      },
      {
        slotOrder: 2,
        defaultExerciseId: 'assisted-dips',
        ...ACCESSORY_DEFAULT,
      },
      {
        slotOrder: 3,
        defaultExerciseId: 'cable-lateral-raise',
        ...ACCESSORY_DEFAULT,
      },
      {
        slotOrder: 4,
        defaultExerciseId: 'preacher-curl-ez',
        ...ACCESSORY_DEFAULT,
        alternateExerciseIds: ['spider-curl'],
      },
      {
        slotOrder: 5,
        defaultExerciseId: 'dead-hang-passive',
        inputMode: 'timed',
        targetSets: 2,
        targetRepLow: 1,
        targetRepHigh: 1,
        restSeconds: 60,
        notes: 'Passive hang for 30-60s.',
      },
    ],
  },
  {
    dayNumber: 3,
    dayName: 'Upper Pull A',
    slots: [
      {
        slotOrder: 1,
        defaultExerciseId: 'rack-assisted-chin-up',
        ...STRENGTH_DEFAULT,
      },
      {
        slotOrder: 2,
        defaultExerciseId: 'machine-row',
        ...ACCESSORY_DEFAULT,
        alternateExerciseIds: ['inverted-row', 'seated-cable-row'],
      },
      {
        slotOrder: 3,
        defaultExerciseId: 'cable-y-raise',
        ...ACCESSORY_DEFAULT,
      },
      {
        slotOrder: 4,
        defaultExerciseId: 'triceps-extension-cable',
        ...ACCESSORY_DEFAULT,
      },
      {
        slotOrder: 5,
        defaultExerciseId: 'box-step-overs',
        inputMode: 'timed',
        targetSets: 1,
        targetRepLow: 1,
        targetRepHigh: 1,
        restSeconds: 120,
        notes: 'Timed: 2 minutes total alternating legs.',
      },
      {
        slotOrder: 6,
        defaultExerciseId: 'ql-walk-carry',
        inputMode: 'timed',
        targetSets: 1,
        targetRepLow: 1,
        targetRepHigh: 1,
        restSeconds: 60,
        notes: 'Timed: 1 minute loaded carry.',
      },
    ],
  },
  {
    dayNumber: 4,
    dayName: 'Lower B',
    slots: [
      {
        slotOrder: 1,
        defaultExerciseId: 'bss-hops',
        targetSets: 2,
        targetRepLow: 20,
        targetRepHigh: 20,
        restSeconds: 90,
        notes: 'Per leg explosive contacts.',
      },
      {
        slotOrder: 2,
        defaultExerciseId: 'bulgarian-split-squat',
        ...ACCESSORY_DEFAULT,
        notes: 'Slow 3s eccentric.',
      },
      {
        slotOrder: 3,
        defaultExerciseId: 'single-leg-stiff-leg-deadlift',
        ...ACCESSORY_DEFAULT,
      },
      {
        slotOrder: 4,
        defaultExerciseId: 'leg-extension',
        ...ACCESSORY_DEFAULT,
      },
      {
        slotOrder: 5,
        defaultExerciseId: 'mobility-metcon',
        inputMode: 'timed',
        targetSets: 1,
        targetRepLow: 1,
        targetRepHigh: 1,
        restSeconds: 45,
        notes: 'Mobility circuit; not counted toward hypertrophy volume.',
      },
    ],
  },
  {
    dayNumber: 5,
    dayName: 'Upper Push B',
    slots: [
      {
        slotOrder: 1,
        defaultExerciseId: 'db-incline-press',
        ...STRENGTH_DEFAULT,
      },
      {
        slotOrder: 2,
        defaultExerciseId: 'cable-crossover',
        ...ACCESSORY_DEFAULT,
      },
      {
        slotOrder: 3,
        defaultExerciseId: 'side-lying-lateral-raise',
        ...ACCESSORY_DEFAULT,
      },
      {
        slotOrder: 4,
        defaultExerciseId: 'spider-curl',
        ...ACCESSORY_DEFAULT,
        alternateExerciseIds: ['preacher-curl-ez', 'barbell-curl', 'dumbbell-curl'],
      },
      {
        slotOrder: 5,
        defaultExerciseId: 'dead-hang-passive',
        inputMode: 'timed',
        targetSets: 2,
        targetRepLow: 1,
        targetRepHigh: 1,
        restSeconds: 60,
        notes: 'Passive hang for 30-60s.',
      },
    ],
  },
  {
    dayNumber: 6,
    dayName: 'Upper Pull B',
    slots: [
      {
        slotOrder: 1,
        defaultExerciseId: 'lat-pulldown',
        ...STRENGTH_DEFAULT,
      },
      {
        slotOrder: 2,
        defaultExerciseId: 'inverted-row',
        ...ACCESSORY_DEFAULT,
        alternateExerciseIds: ['machine-row'],
      },
      {
        slotOrder: 3,
        defaultExerciseId: 'rear-delt-fly',
        ...ACCESSORY_DEFAULT,
      },
      {
        slotOrder: 4,
        defaultExerciseId: 'triceps-extension-cable',
        ...ACCESSORY_DEFAULT,
      },
      {
        slotOrder: 5,
        defaultExerciseId: 'hill-sprints',
        inputMode: 'timed',
        targetSets: 6,
        targetRepLow: 1,
        targetRepHigh: 1,
        restSeconds: 60,
        notes: 'Timed intervals: 60s on / 60s off.',
      },
    ],
  },
];

export const placeholderDayTemplate: DayTemplateWithSlots = {
  id: -1,
  phaseId: HYBRID_PHASE_1_ID,
  dayNumber: 1,
  dayName: 'Lower A',
  slots: [],
};
