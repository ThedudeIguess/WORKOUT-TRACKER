import { create } from 'zustand';
import type { EffortLabel } from '../types';

export interface DraftSetInput {
  loadKg: string;
  reps: string;
  effortLabel: EffortLabel | null;
  isWarmup: boolean;
}

interface WorkoutStoreState {
  expandedSlotIds: number[];
  draftSetsBySlotId: Record<number, DraftSetInput>;
  restTimer: {
    totalSeconds: number;
    remainingSeconds: number;
    isRunning: boolean;
    endsAtMs: number | null;
  };
  toggleSlotExpanded: (slotId: number) => void;
  setDraftSet: (slotId: number, input: DraftSetInput) => void;
  clearDraftSet: (slotId: number) => void;
  clearSessionUiState: () => void;
  startRestTimer: (seconds: number) => void;
  tickRestTimer: () => void;
  pauseRestTimer: () => void;
  resetRestTimer: () => void;
  dismissRestTimer: () => void;
}

const defaultRestTimer = {
  totalSeconds: 0,
  remainingSeconds: 0,
  isRunning: false,
  endsAtMs: null,
};

export const useWorkoutStore = create<WorkoutStoreState>((set, get) => ({
  expandedSlotIds: [],
  draftSetsBySlotId: {},
  restTimer: defaultRestTimer,
  toggleSlotExpanded: (slotId) =>
    set((state) => {
      const isExpanded = state.expandedSlotIds.includes(slotId);
      return {
        expandedSlotIds: isExpanded
          ? state.expandedSlotIds.filter((id) => id !== slotId)
          : [...state.expandedSlotIds, slotId],
      };
    }),
  setDraftSet: (slotId, input) =>
    set((state) => ({
      draftSetsBySlotId: {
        ...state.draftSetsBySlotId,
        [slotId]: input,
      },
    })),
  clearDraftSet: (slotId) =>
    set((state) => {
      const nextDrafts = { ...state.draftSetsBySlotId };
      delete nextDrafts[slotId];
      return { draftSetsBySlotId: nextDrafts };
    }),
  clearSessionUiState: () =>
    set({
      expandedSlotIds: [],
      draftSetsBySlotId: {},
      restTimer: defaultRestTimer,
    }),
  startRestTimer: (seconds) =>
    set({
      restTimer: {
        totalSeconds: seconds,
        remainingSeconds: seconds,
        isRunning: true,
        endsAtMs: Date.now() + seconds * 1000,
      },
    }),
  tickRestTimer: () => {
    const timer = get().restTimer;
    if (!timer.isRunning || timer.endsAtMs === null) {
      return;
    }

    const remainingSeconds = Math.max(
      0,
      Math.ceil((timer.endsAtMs - Date.now()) / 1000)
    );

    if (remainingSeconds === 0) {
      set({
        restTimer: {
          ...timer,
          remainingSeconds: 0,
          isRunning: false,
          endsAtMs: null,
        },
      });
      return;
    }

    set({
      restTimer: {
        ...timer,
        remainingSeconds,
      },
    });
  },
  pauseRestTimer: () =>
    set((state) => ({
      restTimer: {
        ...state.restTimer,
        isRunning: false,
        endsAtMs: null,
      },
    })),
  resetRestTimer: () =>
    set((state) => ({
      restTimer: {
        ...state.restTimer,
        remainingSeconds: state.restTimer.totalSeconds,
        isRunning: false,
        endsAtMs: null,
      },
    })),
  dismissRestTimer: () =>
    set({
      restTimer: defaultRestTimer,
    }),
}));
