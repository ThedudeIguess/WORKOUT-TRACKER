import { HYBRID_PHASE_1_ID } from '../constants/programTemplates';
import { type EffortLabel } from '../types';
import { getDatabase } from './schema';

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

const historicalSessions: HistoricalSession[] = [
  {
    date: '2025-12-25',
    dayNumber: 1,
    sets: [
      { exerciseId: 'broad-jumps', reps: 5, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'broad-jumps', reps: 5, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'broad-jumps', reps: 5, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'barbell-back-squat', reps: 6, loadKg: 20, effortLabel: 'easy' },
      { exerciseId: 'barbell-back-squat', reps: 6, loadKg: 30, effortLabel: 'productive' },
      {
        exerciseId: 'seated-leg-curl',
        reps: 7,
        loadKg: 25,
        effortLabel: 'productive',
        notes: 'lying leg curl',
      },
      { exerciseId: 'seated-leg-curl', reps: 6, loadKg: 32, effortLabel: 'productive' },
      { exerciseId: 'hanging-knee-raise', reps: 6, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'hyperextension-glute', reps: 7, loadKg: 0, effortLabel: 'productive' },
      {
        exerciseId: 'wall-hip-flexor-stretch',
        reps: 17,
        loadKg: 0,
        effortLabel: 'easy',
        notes: '17 seconds',
      },
      {
        exerciseId: 'wall-hip-flexor-stretch',
        reps: 15,
        loadKg: 0,
        effortLabel: 'easy',
        notes: '15 seconds',
      },
    ],
  },
  {
    date: '2025-12-29',
    dayNumber: 2,
    sets: [
      { exerciseId: 'barbell-bench-press', reps: 10, loadKg: 20, effortLabel: 'easy' },
      { exerciseId: 'barbell-bench-press', reps: 6, loadKg: 25, effortLabel: 'productive' },
      {
        exerciseId: 'assisted-dips',
        reps: 6,
        loadKg: 0,
        effortLabel: 'productive',
        notes: 'elevated push-up substitute',
      },
      {
        exerciseId: 'assisted-dips',
        reps: 4,
        loadKg: 0,
        effortLabel: 'hard',
        notes: 'elevated push-up substitute',
      },
      {
        exerciseId: 'cable-lateral-raise',
        reps: 7,
        loadKg: 3.75,
        effortLabel: 'productive',
        notes: 'cable crucifix raise',
      },
      { exerciseId: 'cable-lateral-raise', reps: 10, loadKg: 3.75, effortLabel: 'productive' },
      { exerciseId: 'preacher-curl-ez', reps: 10, loadKg: 4.54, effortLabel: 'productive' },
      { exerciseId: 'preacher-curl-ez', reps: 10, loadKg: 4.54, effortLabel: 'productive' },
      {
        exerciseId: 'dead-hang-passive',
        reps: 42,
        loadKg: 0,
        effortLabel: 'hard',
        notes: '42s, full BW',
      },
      {
        exerciseId: 'dead-hang-passive',
        reps: 50,
        loadKg: 0,
        effortLabel: 'hard',
        notes: '50s, full BW',
      },
    ],
  },
  {
    date: '2025-12-31',
    dayNumber: 3,
    sets: [
      {
        exerciseId: 'rack-assisted-chin-up',
        reps: 6,
        loadKg: 0,
        effortLabel: 'productive',
        notes: 'rack chin, 0 added load',
      },
      { exerciseId: 'rack-assisted-chin-up', reps: 4, loadKg: 0, effortLabel: 'hard' },
      { exerciseId: 'machine-row', reps: 6, loadKg: 10, effortLabel: 'productive' },
      { exerciseId: 'machine-row', reps: 6, loadKg: 10, effortLabel: 'productive' },
      {
        exerciseId: 'cable-y-raise',
        reps: 8,
        loadKg: 2.27,
        effortLabel: 'productive',
        notes: 'DB Y-raise',
      },
      {
        exerciseId: 'cable-y-raise',
        reps: 7,
        loadKg: 4.54,
        effortLabel: 'productive',
        notes: 'DB Y-raise',
      },
      { exerciseId: 'triceps-extension-cable', reps: 6, loadKg: 10, effortLabel: 'productive' },
      { exerciseId: 'triceps-extension-cable', reps: 6, loadKg: 10, effortLabel: 'productive' },
      {
        exerciseId: 'box-step-overs',
        reps: 120,
        loadKg: 0,
        effortLabel: 'productive',
        notes: '1 round (2 min)',
      },
      {
        exerciseId: 'ql-walk-carry',
        reps: 60,
        loadKg: 0,
        effortLabel: 'productive',
        notes: '1 round (1 min)',
      },
    ],
  },
  {
    date: '2026-01-07',
    dayNumber: 4,
    sets: [
      { exerciseId: 'bss-hops', reps: 10, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'bss-hops', reps: 10, loadKg: 0, effortLabel: 'productive' },
      {
        exerciseId: 'bulgarian-split-squat',
        reps: 6,
        loadKg: 5,
        effortLabel: 'productive',
        notes: 'per-hand DB weight',
      },
      { exerciseId: 'bulgarian-split-squat', reps: 6, loadKg: 10, effortLabel: 'productive' },
      {
        exerciseId: 'single-leg-stiff-leg-deadlift',
        reps: 7,
        loadKg: 16,
        effortLabel: 'productive',
        notes: 'DB RDL',
      },
      {
        exerciseId: 'single-leg-stiff-leg-deadlift',
        reps: 6,
        loadKg: 16,
        effortLabel: 'productive',
      },
      { exerciseId: 'leg-extension', reps: 10, loadKg: 30, effortLabel: 'productive' },
      { exerciseId: 'leg-extension', reps: 10, loadKg: 40, effortLabel: 'productive' },
      {
        exerciseId: 'mobility-metcon',
        reps: 2,
        loadKg: 0,
        effortLabel: 'productive',
        notes: '2 rounds; suitcase carry 12+20 kg',
      },
    ],
  },
  {
    date: '2026-01-14',
    dayNumber: 5,
    sets: [
      { exerciseId: 'db-incline-press', reps: 10, loadKg: 4.54, effortLabel: 'easy' },
      { exerciseId: 'db-incline-press', reps: 10, loadKg: 9.07, effortLabel: 'productive' },
      { exerciseId: 'cable-crossover', reps: 11, loadKg: 4.5, effortLabel: 'productive' },
      { exerciseId: 'cable-crossover', reps: 8, loadKg: 6.5, effortLabel: 'hard' },
      {
        exerciseId: 'cable-crossover',
        reps: 3,
        loadKg: 4.5,
        effortLabel: 'hard',
        notes: 'drop set',
      },
      {
        exerciseId: 'side-lying-lateral-raise',
        reps: 15,
        loadKg: 6.8,
        effortLabel: 'productive',
        notes: '1 set only',
      },
      { exerciseId: 'dumbbell-curl', reps: 10, loadKg: 6.8, effortLabel: 'productive' },
      { exerciseId: 'dumbbell-curl', reps: 5, loadKg: 10, effortLabel: 'hard' },
      {
        exerciseId: 'dead-hang-passive',
        reps: 50,
        loadKg: 0,
        effortLabel: 'hard',
        notes: '50s, full BW, 1 set',
      },
    ],
  },
  {
    date: '2026-01-15',
    dayNumber: 6,
    sets: [
      { exerciseId: 'lat-pulldown', reps: 6, loadKg: 35, effortLabel: 'productive' },
      { exerciseId: 'lat-pulldown', reps: 10, loadKg: 35, effortLabel: 'productive' },
      {
        exerciseId: 'machine-row',
        reps: 15,
        loadKg: 5,
        effortLabel: 'easy',
        notes: 'T-bar row',
      },
      {
        exerciseId: 'machine-row',
        reps: 11,
        loadKg: 10,
        effortLabel: 'productive',
        notes: 'T-bar row',
      },
      {
        exerciseId: 'rear-delt-fly',
        reps: 10,
        loadKg: 6.25,
        effortLabel: 'productive',
        notes: 'cable rear delt fly',
      },
      {
        exerciseId: 'rear-delt-fly',
        reps: 13,
        loadKg: 8.25,
        effortLabel: 'productive',
        notes: 'cable; left hand 6.25 kg x 10',
      },
      {
        exerciseId: 'triceps-extension-cable',
        reps: 10,
        loadKg: 8.75,
        effortLabel: 'productive',
        notes: 'tricep pushdown',
      },
      { exerciseId: 'triceps-extension-cable', reps: 10, loadKg: 13.75, effortLabel: 'productive' },
    ],
  },
  {
    date: '2026-01-16',
    dayNumber: 1,
    sets: [
      { exerciseId: 'broad-jumps', reps: 5, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'broad-jumps', reps: 5, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'broad-jumps', reps: 5, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'barbell-back-squat', reps: 6, loadKg: 30, effortLabel: 'productive' },
      { exerciseId: 'barbell-back-squat', reps: 6, loadKg: 40, effortLabel: 'productive' },
      { exerciseId: 'seated-leg-curl', reps: 10, loadKg: 27, effortLabel: 'productive' },
      { exerciseId: 'seated-leg-curl', reps: 10, loadKg: 35, effortLabel: 'productive' },
      {
        exerciseId: 'hanging-knee-raise',
        reps: 6,
        loadKg: 0,
        effortLabel: 'easy',
        notes: 'exercise ball ab crunch sub',
      },
      {
        exerciseId: 'wall-hip-flexor-stretch',
        reps: 16,
        loadKg: 0,
        effortLabel: 'easy',
        notes: '16s, 1 set',
      },
    ],
  },
  {
    date: '2026-01-18',
    dayNumber: 2,
    sets: [
      { exerciseId: 'barbell-bench-press', reps: 10, loadKg: 25, effortLabel: 'productive' },
      { exerciseId: 'barbell-bench-press', reps: 3, loadKg: 30, effortLabel: 'hard' },
      { exerciseId: 'assisted-dips', reps: 6, loadKg: 23, effortLabel: 'productive' },
      { exerciseId: 'assisted-dips', reps: 10, loadKg: 23, effortLabel: 'productive' },
      { exerciseId: 'cable-lateral-raise', reps: 15, loadKg: 3.75, effortLabel: 'productive' },
      { exerciseId: 'cable-lateral-raise', reps: 11, loadKg: 6.25, effortLabel: 'productive' },
      { exerciseId: 'spider-curl', reps: 10, loadKg: 4.54, effortLabel: 'productive' },
      { exerciseId: 'spider-curl', reps: 10, loadKg: 9.07, effortLabel: 'productive' },
      {
        exerciseId: 'dead-hang-passive',
        reps: 60,
        loadKg: 0,
        effortLabel: 'productive',
        notes: '60s, 1 set',
      },
    ],
  },
  {
    date: '2026-01-19',
    dayNumber: 3,
    sets: [
      { exerciseId: 'rack-assisted-chin-up', reps: 10, loadKg: 23, effortLabel: 'productive' },
      { exerciseId: 'rack-assisted-chin-up', reps: 10, loadKg: 23, effortLabel: 'productive' },
      { exerciseId: 'machine-row', reps: 10, loadKg: 6, effortLabel: 'easy' },
      { exerciseId: 'machine-row', reps: 10, loadKg: 6, effortLabel: 'easy' },
      {
        exerciseId: 'cable-y-raise',
        reps: 10,
        loadKg: 4.54,
        effortLabel: 'productive',
        notes: 'DB Y-raise',
      },
      {
        exerciseId: 'cable-y-raise',
        reps: 10,
        loadKg: 4.54,
        effortLabel: 'productive',
        notes: 'DB Y-raise',
      },
      {
        exerciseId: 'triceps-extension-cable',
        reps: 10,
        loadKg: 13.5,
        effortLabel: 'productive',
        notes: 'overhead extension',
      },
      { exerciseId: 'triceps-extension-cable', reps: 5, loadKg: 18, effortLabel: 'hard' },
      {
        exerciseId: 'box-step-overs',
        reps: 360,
        loadKg: 0,
        effortLabel: 'productive',
        notes: '3 rounds',
      },
      { exerciseId: 'ql-walk-carry', reps: 180, loadKg: 0, effortLabel: 'productive', notes: '3 rounds' },
    ],
  },
  {
    date: '2026-01-21',
    dayNumber: 4,
    sets: [
      { exerciseId: 'bss-hops', reps: 10, loadKg: 0, effortLabel: 'productive', notes: '1 set only' },
      { exerciseId: 'single-leg-stiff-leg-deadlift', reps: 6, loadKg: 10, effortLabel: 'productive' },
      { exerciseId: 'single-leg-stiff-leg-deadlift', reps: 10, loadKg: 10, effortLabel: 'productive' },
      { exerciseId: 'leg-extension', reps: 10, loadKg: 35, effortLabel: 'productive' },
      { exerciseId: 'leg-extension', reps: 10, loadKg: 42, effortLabel: 'productive' },
      {
        exerciseId: 'mobility-metcon',
        reps: 5,
        loadKg: 0,
        effortLabel: 'productive',
        notes: 'completed, weights not recorded',
      },
    ],
  },
  {
    date: '2026-01-24',
    dayNumber: 5,
    bodyweightKg: 79.9,
    sets: [
      {
        exerciseId: 'db-incline-press',
        reps: 15,
        loadKg: 6.8,
        effortLabel: 'easy',
        notes: 'way too light',
      },
      {
        exerciseId: 'db-incline-press',
        reps: 20,
        loadKg: 6.8,
        effortLabel: 'easy',
        notes: 'way too light',
      },
      {
        exerciseId: 'cable-crossover',
        reps: 10,
        loadKg: 9,
        effortLabel: 'productive',
        notes: 'cable chest press variant',
      },
      {
        exerciseId: 'cable-crossover',
        reps: 10,
        loadKg: 11,
        effortLabel: 'productive',
        notes: 'cable chest press variant',
      },
      { exerciseId: 'side-lying-lateral-raise', reps: 15, loadKg: 4.54, effortLabel: 'productive' },
      { exerciseId: 'side-lying-lateral-raise', reps: 10, loadKg: 4.54, effortLabel: 'productive' },
      { exerciseId: 'dumbbell-curl', reps: 10, loadKg: 6.8, effortLabel: 'productive', notes: 'Zottman curl' },
      { exerciseId: 'dumbbell-curl', reps: 10, loadKg: 9.07, effortLabel: 'productive', notes: 'Zottman curl' },
      {
        exerciseId: 'dead-hang-passive',
        reps: 60,
        loadKg: 0,
        effortLabel: 'productive',
        notes: '47.5 kg assist',
      },
      {
        exerciseId: 'dead-hang-passive',
        reps: 60,
        loadKg: 0,
        effortLabel: 'productive',
        notes: '47.5 kg assist',
      },
      { exerciseId: 'dead-hang-passive', reps: 60, loadKg: 0, effortLabel: 'hard', notes: '40 kg assist' },
    ],
  },
  {
    date: '2026-01-25',
    dayNumber: 6,
    sets: [
      { exerciseId: 'lat-pulldown', reps: 10, loadKg: 40, effortLabel: 'productive' },
      { exerciseId: 'lat-pulldown', reps: 10, loadKg: 45, effortLabel: 'productive' },
      { exerciseId: 'rack-assisted-chin-up', reps: 10, loadKg: 23, effortLabel: 'productive' },
      { exerciseId: 'rack-assisted-chin-up', reps: 14, loadKg: 23, effortLabel: 'productive' },
      {
        exerciseId: 'rear-delt-fly',
        reps: 15,
        loadKg: 6.25,
        effortLabel: 'productive',
        notes: 'cable rear delt fly',
      },
      { exerciseId: 'rear-delt-fly', reps: 13, loadKg: 8.25, effortLabel: 'productive', notes: 'cable' },
      {
        exerciseId: 'triceps-extension-cable',
        reps: 6,
        loadKg: 6.25,
        effortLabel: 'hard',
        notes: 'cross-body single arm',
      },
      {
        exerciseId: 'triceps-extension-cable',
        reps: 5,
        loadKg: 6.25,
        effortLabel: 'hard',
        notes: 'cross-body single arm',
      },
      {
        exerciseId: 'hill-sprints',
        reps: 360,
        loadKg: 0,
        effortLabel: 'productive',
        notes: '6 min, 3 intervals, flat treadmill',
      },
    ],
  },
  {
    date: '2026-01-28',
    dayNumber: 1,
    sets: [
      { exerciseId: 'broad-jumps', reps: 5, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'broad-jumps', reps: 5, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'broad-jumps', reps: 5, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'barbell-back-squat', reps: 6, loadKg: 40, effortLabel: 'productive' },
      { exerciseId: 'barbell-back-squat', reps: 6, loadKg: 50, effortLabel: 'productive' },
      { exerciseId: 'seated-leg-curl', reps: 10, loadKg: 40, effortLabel: 'productive' },
      { exerciseId: 'seated-leg-curl', reps: 10, loadKg: 47, effortLabel: 'productive' },
      {
        exerciseId: 'ghd-raise',
        reps: 10,
        loadKg: 0,
        effortLabel: 'productive',
        notes: 'unsure about technique',
      },
      {
        exerciseId: 'ghd-raise',
        reps: 8,
        loadKg: 0,
        effortLabel: 'productive',
        notes: 'unsure about technique',
      },
      { exerciseId: 'wall-hip-flexor-stretch', reps: 30, loadKg: 0, effortLabel: 'easy' },
      { exerciseId: 'wall-hip-flexor-stretch', reps: 30, loadKg: 0, effortLabel: 'easy' },
      { exerciseId: 'wall-hip-flexor-stretch', reps: 30, loadKg: 0, effortLabel: 'easy' },
    ],
  },
  {
    date: '2026-01-29',
    dayNumber: 2,
    bodyweightKg: 79.6,
    sets: [
      { exerciseId: 'barbell-bench-press', reps: 10, loadKg: 25, effortLabel: 'productive' },
      { exerciseId: 'barbell-bench-press', reps: 6, loadKg: 30, effortLabel: 'productive' },
      { exerciseId: 'assisted-dips', reps: 10, loadKg: 32, effortLabel: 'productive' },
      { exerciseId: 'assisted-dips', reps: 8, loadKg: 40, effortLabel: 'productive' },
      { exerciseId: 'cable-lateral-raise', reps: 15, loadKg: 6.25, effortLabel: 'productive' },
      { exerciseId: 'cable-lateral-raise', reps: 15, loadKg: 6.25, effortLabel: 'productive' },
      { exerciseId: 'preacher-curl-ez', reps: 10, loadKg: 4.54, effortLabel: 'productive' },
      { exerciseId: 'preacher-curl-ez', reps: 10, loadKg: 6.8, effortLabel: 'productive' },
      {
        exerciseId: 'dead-hang-passive',
        reps: 60,
        loadKg: 0,
        effortLabel: 'productive',
        notes: '47.5 kg assist',
      },
      {
        exerciseId: 'dead-hang-passive',
        reps: 60,
        loadKg: 0,
        effortLabel: 'productive',
        notes: '40 kg assist',
      },
      { exerciseId: 'dead-hang-passive', reps: 60, loadKg: 0, effortLabel: 'hard', notes: '40 kg assist' },
    ],
  },
  {
    date: '2026-02-02',
    dayNumber: 3,
    sets: [
      { exerciseId: 'rack-assisted-chin-up', reps: 6, loadKg: 38, effortLabel: 'productive' },
      { exerciseId: 'rack-assisted-chin-up', reps: 5, loadKg: 38, effortLabel: 'hard' },
      { exerciseId: 'machine-row', reps: 10, loadKg: 10, effortLabel: 'productive', notes: 'T-bar row' },
      { exerciseId: 'machine-row', reps: 7, loadKg: 20, effortLabel: 'productive' },
      {
        exerciseId: 'cable-y-raise',
        reps: 10,
        loadKg: 4.54,
        effortLabel: 'productive',
        notes: 'tried 15 lbs, form broke',
      },
      { exerciseId: 'cable-y-raise', reps: 10, loadKg: 4.54, effortLabel: 'productive' },
      { exerciseId: 'triceps-extension-cable', reps: 10, loadKg: 8.75, effortLabel: 'productive' },
      { exerciseId: 'triceps-extension-cable', reps: 10, loadKg: 8.75, effortLabel: 'productive' },
      {
        exerciseId: 'box-step-overs',
        reps: 480,
        loadKg: 0,
        effortLabel: 'productive',
        notes: '4 rounds (16 min total)',
      },
      { exerciseId: 'ql-walk-carry', reps: 240, loadKg: 0, effortLabel: 'productive', notes: '4 rounds' },
    ],
  },
  {
    date: '2026-02-04',
    dayNumber: 5,
    bodyweightKg: 79.9,
    sets: [
      { exerciseId: 'db-incline-press', reps: 10, loadKg: 9.07, effortLabel: 'productive' },
      { exerciseId: 'db-incline-press', reps: 10, loadKg: 11.34, effortLabel: 'productive' },
      { exerciseId: 'cable-crossover', reps: 15, loadKg: 7, effortLabel: 'productive' },
      { exerciseId: 'cable-crossover', reps: 15, loadKg: 9, effortLabel: 'productive' },
      { exerciseId: 'side-lying-lateral-raise', reps: 15, loadKg: 4.54, effortLabel: 'productive' },
      {
        exerciseId: 'side-lying-lateral-raise',
        reps: 10,
        loadKg: 6.8,
        effortLabel: 'productive',
        notes: 'also did 5 lbs left hand >10 reps',
      },
      { exerciseId: 'dumbbell-curl', reps: 10, loadKg: 9.07, effortLabel: 'productive' },
      { exerciseId: 'dumbbell-curl', reps: 8, loadKg: 11.34, effortLabel: 'hard' },
      {
        exerciseId: 'dead-hang-passive',
        reps: 45,
        loadKg: 0,
        effortLabel: 'hard',
        notes: '40 kg assist, broke halfway',
      },
      {
        exerciseId: 'dead-hang-passive',
        reps: 45,
        loadKg: 0,
        effortLabel: 'hard',
        notes: '47.5 kg assist, broke halfway',
      },
    ],
  },
  {
    date: '2026-02-05',
    dayNumber: 4,
    sets: [
      { exerciseId: 'bss-hops', reps: 10, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'bss-hops', reps: 10, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'bss-hops', reps: 10, loadKg: 0, effortLabel: 'productive' },
      {
        exerciseId: 'bulgarian-split-squat',
        reps: 10,
        loadKg: 5,
        effortLabel: 'productive',
        notes: 'pole for balance',
      },
      {
        exerciseId: 'bulgarian-split-squat',
        reps: 10,
        loadKg: 10,
        effortLabel: 'productive',
        notes: 'pole for balance',
      },
      {
        exerciseId: 'single-leg-stiff-leg-deadlift',
        reps: 10,
        loadKg: 10,
        effortLabel: 'productive',
        notes: 'stamina limited',
      },
      {
        exerciseId: 'single-leg-stiff-leg-deadlift',
        reps: 10,
        loadKg: 20,
        effortLabel: 'productive',
        notes: 'stamina limited',
      },
      { exerciseId: 'leg-extension', reps: 10, loadKg: 42, effortLabel: 'productive' },
      { exerciseId: 'leg-extension', reps: 10, loadKg: 50, effortLabel: 'productive' },
      {
        exerciseId: 'mobility-metcon',
        reps: 5,
        loadKg: 0,
        effortLabel: 'productive',
        notes: 'thread the needle sub, suitcase ~40 lbs',
      },
    ],
  },
  {
    date: '2026-02-06',
    dayNumber: 6,
    sets: [
      { exerciseId: 'lat-pulldown', reps: 10, loadKg: 50, effortLabel: 'productive' },
      { exerciseId: 'lat-pulldown', reps: 8, loadKg: 55, effortLabel: 'productive' },
      { exerciseId: 'rack-assisted-chin-up', reps: 5, loadKg: 38, effortLabel: 'productive' },
      { exerciseId: 'rack-assisted-chin-up', reps: 10, loadKg: 38, effortLabel: 'productive' },
      {
        exerciseId: 'rear-delt-fly',
        reps: 15,
        loadKg: 6.25,
        effortLabel: 'productive',
        notes: 'cable rear delt fly',
      },
      {
        exerciseId: 'rear-delt-fly',
        reps: 15,
        loadKg: 6.25,
        effortLabel: 'productive',
        notes: 'cable rear delt fly',
      },
      {
        exerciseId: 'triceps-extension-cable',
        reps: 10,
        loadKg: 8.75,
        effortLabel: 'productive',
        notes: 'cable cross',
      },
      { exerciseId: 'triceps-extension-cable', reps: 7, loadKg: 8.75, effortLabel: 'hard' },
      {
        exerciseId: 'hill-sprints',
        reps: 120,
        loadKg: 0,
        effortLabel: 'hard',
        notes: '2 rounds, barely completed',
      },
    ],
  },
  {
    date: '2026-02-09',
    dayNumber: 1,
    sets: [
      { exerciseId: 'broad-jumps', reps: 5, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'broad-jumps', reps: 5, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'broad-jumps', reps: 5, loadKg: 0, effortLabel: 'productive' },
      { exerciseId: 'barbell-back-squat', reps: 6, loadKg: 40, effortLabel: 'easy' },
      { exerciseId: 'barbell-back-squat', reps: 6, loadKg: 60, effortLabel: 'productive' },
      { exerciseId: 'seated-leg-curl', reps: 10, loadKg: 54, effortLabel: 'productive' },
      { exerciseId: 'seated-leg-curl', reps: 10, loadKg: 61, effortLabel: 'productive' },
      { exerciseId: 'hanging-knee-raise', reps: 10, loadKg: 0, effortLabel: 'productive', notes: 'knee raises' },
      { exerciseId: 'hanging-knee-raise', reps: 10, loadKg: 0, effortLabel: 'productive', notes: 'leg raises' },
      { exerciseId: 'wall-hip-flexor-stretch', reps: 30, loadKg: 0, effortLabel: 'easy' },
      { exerciseId: 'wall-hip-flexor-stretch', reps: 30, loadKg: 0, effortLabel: 'easy' },
      {
        exerciseId: 'hyperextension-glute',
        reps: 15,
        loadKg: 0,
        effortLabel: 'easy',
        notes: 'BW only',
      },
      {
        exerciseId: 'hyperextension-glute',
        reps: 15,
        loadKg: 0,
        effortLabel: 'easy',
        notes: 'BW only',
      },
    ],
  },
  {
    date: '2026-02-11',
    dayNumber: 2,
    sets: [
      { exerciseId: 'barbell-bench-press', reps: 9, loadKg: 27.5, effortLabel: 'productive' },
      {
        exerciseId: 'barbell-bench-press',
        reps: 8,
        loadKg: 30,
        effortLabel: 'hard',
        notes: "half ROM, didn't go fully down",
      },
      { exerciseId: 'assisted-dips', reps: 10, loadKg: 38, effortLabel: 'productive' },
      { exerciseId: 'assisted-dips', reps: 6, loadKg: 38, effortLabel: 'hard' },
      { exerciseId: 'cable-lateral-raise', reps: 15, loadKg: 3, effortLabel: 'productive', notes: 'new machine' },
      {
        exerciseId: 'cable-lateral-raise',
        reps: 11,
        loadKg: 4.5,
        effortLabel: 'productive',
        notes: 'finally understood exercise at week 4',
      },
      { exerciseId: 'spider-curl', reps: 10, loadKg: 9.07, effortLabel: 'productive' },
      { exerciseId: 'spider-curl', reps: 10, loadKg: 11.34, effortLabel: 'failure', notes: 'to failure' },
      {
        exerciseId: 'dead-hang-passive',
        reps: 60,
        loadKg: 0,
        effortLabel: 'productive',
        notes: '40 kg assist, 60s clean, no breaks (first time)',
      },
      {
        exerciseId: 'dead-hang-passive',
        reps: 60,
        loadKg: 0,
        effortLabel: 'hard',
        notes: '47.5 kg assist, with break',
      },
      {
        exerciseId: 'dead-hang-passive',
        reps: 60,
        loadKg: 0,
        effortLabel: 'hard',
        notes: '55 kg assist, with break',
      },
    ],
  },
  {
    date: '2026-02-12',
    dayNumber: 3,
    sets: [
      {
        exerciseId: 'lat-pulldown',
        reps: 10,
        loadKg: 55,
        effortLabel: 'productive',
        notes: 'used lat pulldown instead of chin-up',
      },
      { exerciseId: 'lat-pulldown', reps: 7, loadKg: 60, effortLabel: 'hard' },
      { exerciseId: 'machine-row', reps: 10, loadKg: 15, effortLabel: 'productive', notes: 'T-bar row' },
      { exerciseId: 'machine-row', reps: 6, loadKg: 25, effortLabel: 'productive' },
      {
        exerciseId: 'cable-y-raise',
        reps: 10,
        loadKg: 4.54,
        effortLabel: 'productive',
        notes: 'DB Y-raise',
      },
      {
        exerciseId: 'cable-y-raise',
        reps: 6,
        loadKg: 6.8,
        effortLabel: 'hard',
        notes: 'barely',
      },
      {
        exerciseId: 'triceps-extension-cable',
        reps: 10,
        loadKg: 13.75,
        effortLabel: 'productive',
        notes: 'overhead extension',
      },
      { exerciseId: 'triceps-extension-cable', reps: 9, loadKg: 18, effortLabel: 'hard' },
      {
        exerciseId: 'box-step-overs',
        reps: 120,
        loadKg: 0,
        effortLabel: 'hard',
        notes: '1 round only, exhausted',
      },
      {
        exerciseId: 'ql-walk-carry',
        reps: 60,
        loadKg: 0,
        effortLabel: 'hard',
        notes: '1 round only',
      },
    ],
  },
];

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
