import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { ExerciseCard } from '../../components/ExerciseCard';
import { PrsInput } from '../../components/PrsInput';
import { SetRow } from '../../components/SetRow';
import { muscleGroups } from '../../constants/mevThresholds';
import { theme } from '../../constants/theme';
import {
  addSlotAlternate,
  completeWorkoutSession,
  createWorkoutSession,
  deleteSet,
  getActiveWorkout,
  getDayTemplateByDayNumber,
  getMostRecentLoad,
  getWorkoutSets,
  insertCustomExercise,
  insertExerciseMuscleMappings,
  listExerciseLibrary,
  logSet,
  updateSet,
} from '../../db/queries';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWorkoutStore, type DraftSetInput } from '../../stores/workoutStore';
import type {
  DayTemplateWithSlots,
  EffortLabel,
  ExerciseCategory,
  ProgressionSuggestion,
} from '../../types';
import { getProgressionSuggestion } from '../../utils/progressionEngine';

const customExerciseCategories: ExerciseCategory[] = [
  'compound',
  'isolation',
  'metcon',
  'mobility',
];

const effortColorByLabel: Record<EffortLabel, string> = {
  easy: theme.colors.effortEasy,
  productive: theme.colors.effortProductive,
  hard: theme.colors.effortHard,
  failure: theme.colors.effortFailure,
};

interface LocalLoggedSet {
  id: number;
  slotId: number;
  exerciseId: string;
  reps: number;
  loadKg: number;
  effortLabel: EffortLabel;
  isWarmup: boolean;
  setOrder: number;
}

async function scheduleRestNotification(seconds: number): Promise<string | null> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      finalStatus = newStatus;
    }
    if (finalStatus !== 'granted') {
      return null;
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest Timer Done',
        body: 'Time to start your next set!',
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
    });
    return id;
  } catch {
    return null;
  }
}

async function cancelRestNotification(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // ignore
  }
}

export default function ActiveWorkoutScreen() {
  const params = useLocalSearchParams<{
    dayId: string;
    workoutId?: string;
    backdateIso?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const dayNumber = Number(params.dayId || '1');
  const backdateIso = params.backdateIso ?? null;
  const defaultRestSeconds = useSettingsStore((state) => state.defaultRestSeconds);

  const {
    expandedSlotIds,
    draftSetsBySlotId,
    restTimer,
    toggleSlotExpanded,
    setDraftSet,
    clearDraftSet,
    clearSessionUiState,
    startRestTimer,
    tickRestTimer,
    pauseRestTimer,
    resetRestTimer,
    dismissRestTimer,
  } = useWorkoutStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [template, setTemplate] = useState<DayTemplateWithSlots | null>(null);
  const [selectedExerciseBySlot, setSelectedExerciseBySlot] = useState<
    Record<number, { id: string; name: string }>
  >({});
  const [progressionByExercise, setProgressionByExercise] = useState<
    Record<string, ProgressionSuggestion | null>
  >({});
  const [workoutId, setWorkoutId] = useState<string | null>(
    params.workoutId ?? null
  );
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [elapsedStartAt, setElapsedStartAt] = useState<string | null>(null);
  const [prsScore, setPrsScore] = useState<number | null>(null);
  const [bodyweightInput, setBodyweightInput] = useState('');
  const [showFinishFlow, setShowFinishFlow] = useState(false);
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loggedSets, setLoggedSets] = useState<LocalLoggedSet[]>([]);
  const [editingSetBySlotId, setEditingSetBySlotId] = useState<Record<number, number>>(
    {}
  );
  const [swapSlotId, setSwapSlotId] = useState<number | null>(null);
  const restNotificationId = useRef<string | null>(null);
  const [customExerciseOptions, setCustomExerciseOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showCustomExerciseForm, setShowCustomExerciseForm] = useState(false);
  const [creatingCustomExercise, setCreatingCustomExercise] = useState(false);
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [customExerciseCategory, setCustomExerciseCategory] = useState<ExerciseCategory>('isolation');
  const [customPrimaryMuscles, setCustomPrimaryMuscles] = useState<string[]>([]);
  const [customSecondaryMuscles, setCustomSecondaryMuscles] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      clearSessionUiState();
      void cancelRestNotification(restNotificationId.current);
    };
  }, [clearSessionUiState]);

  useEffect(() => {
    if (swapSlotId === null) {
      resetCustomExerciseForm();
    }
  }, [swapSlotId]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const loadedTemplate = await getDayTemplateByDayNumber(dayNumber);
        if (!mounted) {
          return;
        }

        setTemplate(loadedTemplate);

        const selectedDefaults: Record<number, { id: string; name: string }> = {};
        loadedTemplate.slots.forEach((slot) => {
          selectedDefaults[slot.id] = {
            id: slot.defaultExerciseId,
            name: slot.defaultExerciseName,
          };
        });

        const exerciseLibrary = await listExerciseLibrary();
        if (!mounted) {
          return;
        }
        setCustomExerciseOptions(
          exerciseLibrary
            .filter((exercise) => exercise.id.startsWith('custom-') && exercise.isActive)
            .map((exercise) => ({
              id: exercise.id,
              name: exercise.name,
            }))
            .sort((left, right) => left.name.localeCompare(right.name))
        );

        let resolvedWorkoutId = workoutId;
        const activeWorkout = await getActiveWorkout();

        if (
          !backdateIso &&
          activeWorkout &&
          activeWorkout.dayNumber === loadedTemplate.dayNumber &&
          (!resolvedWorkoutId || resolvedWorkoutId === activeWorkout.workoutId)
        ) {
          resolvedWorkoutId = activeWorkout.workoutId;
          setWorkoutId(activeWorkout.workoutId);
          setStartedAt(activeWorkout.startedAt);
          setElapsedStartAt(activeWorkout.startedAt);
        }

        if (resolvedWorkoutId) {
          const persistedSets = await getWorkoutSets(resolvedWorkoutId);

          const hydratedSets: LocalLoggedSet[] = [];
          const selectedFromPersisted = { ...selectedDefaults };

          for (const persistedSet of persistedSets) {
            const matchingSlot = loadedTemplate.slots.find(
              (slot) =>
                slot.defaultExerciseId === persistedSet.exerciseId ||
                slot.alternateExercises.some(
                  (alternate) => alternate.id === persistedSet.exerciseId
                )
            );

            if (!matchingSlot) {
              continue;
            }

            const option =
              matchingSlot.defaultExerciseId === persistedSet.exerciseId
                ? {
                    id: matchingSlot.defaultExerciseId,
                    name: matchingSlot.defaultExerciseName,
                  }
                : matchingSlot.alternateExercises.find(
                    (alternate) => alternate.id === persistedSet.exerciseId
                  );

            if (option) {
              selectedFromPersisted[matchingSlot.id] = {
                id: option.id,
                name: option.name,
              };
            }

            hydratedSets.push({
              id: persistedSet.id,
              slotId: matchingSlot.id,
              exerciseId: persistedSet.exerciseId,
              reps: persistedSet.reps,
              loadKg: persistedSet.loadKg,
              effortLabel: persistedSet.effortLabel,
              isWarmup: persistedSet.isWarmup,
              setOrder: persistedSet.setOrder,
            });
          }

          setLoggedSets(hydratedSets);
          setSelectedExerciseBySlot(selectedFromPersisted);
        } else {
          setSelectedExerciseBySlot(selectedDefaults);
        }

        for (const slot of loadedTemplate.slots) {
          void fetchProgressionHint(slot.defaultExerciseId);
        }
      } catch (error) {
        if (mounted) {
          const message =
            error instanceof Error ? error.message : 'Failed to load workout data.';
          setActionError(message);
          Alert.alert('Workout load failed', message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [backdateIso, dayNumber, workoutId]);

  useEffect(() => {
    if (!elapsedStartAt) {
      return;
    }

    const interval = setInterval(() => {
      const nowMs = Date.now();
      const elapsedStartAtMs = new Date(elapsedStartAt).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((nowMs - elapsedStartAtMs) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [elapsedStartAt]);

  useEffect(() => {
    if (!restTimer.isRunning) {
      return;
    }

    const interval = setInterval(() => {
      tickRestTimer();
    }, 1000);

    return () => clearInterval(interval);
  }, [restTimer.isRunning, tickRestTimer]);

  useEffect(() => {
    if (!restTimer.isRunning && restTimer.remainingSeconds === 0 && restTimer.totalSeconds > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Timer completed naturally - cancel scheduled notification since we're in-app
      void cancelRestNotification(restNotificationId.current);
      restNotificationId.current = null;
    }
  }, [restTimer.isRunning, restTimer.remainingSeconds, restTimer.totalSeconds]);

  const fetchProgressionHint = async (exerciseId: string) => {
    if (progressionByExercise[exerciseId] !== undefined) {
      return;
    }

    const suggestion = await getProgressionSuggestion(exerciseId);
    setProgressionByExercise((current) => ({
      ...current,
      [exerciseId]: suggestion,
    }));
  };

  const showActionError = (
    title: string,
    error: unknown,
    fallbackMessage: string
  ) => {
    const message = error instanceof Error ? error.message : fallbackMessage;
    setActionError(message);
    Alert.alert(title, message);
  };

  const resetCustomExerciseForm = () => {
    setShowCustomExerciseForm(false);
    setCreatingCustomExercise(false);
    setCustomExerciseName('');
    setCustomExerciseCategory('isolation');
    setCustomPrimaryMuscles([]);
    setCustomSecondaryMuscles([]);
  };

  const toggleMuscleSelection = (
    muscleGroupId: string,
    setState: (updater: (current: string[]) => string[]) => void
  ) => {
    setState((current) => {
      if (current.includes(muscleGroupId)) {
        return current.filter((entry) => entry !== muscleGroupId);
      }
      return [...current, muscleGroupId];
    });
  };

  const createCustomExerciseForSwapSlot = async () => {
    if (!swapSlot) {
      return;
    }

    const trimmedName = customExerciseName.trim();
    if (!trimmedName) {
      Alert.alert('Custom exercise', 'Exercise name is required.');
      return;
    }

    if (customPrimaryMuscles.length === 0) {
      Alert.alert('Custom exercise', 'Select at least one primary muscle group.');
      return;
    }

    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9\\s-]/g, '')
      .trim()
      .replace(/\\s+/g, '-');
    const exerciseId = `custom-${slug || 'exercise'}-${Date.now()}`;

    const secondaryMuscles = customSecondaryMuscles.filter(
      (muscleGroup) => !customPrimaryMuscles.includes(muscleGroup)
    );

    setCreatingCustomExercise(true);
    try {
      await insertCustomExercise({
        id: exerciseId,
        name: trimmedName,
        category: customExerciseCategory,
        equipment: null,
      });

      await insertExerciseMuscleMappings([
        ...customPrimaryMuscles.map((muscleGroup) => ({
          exerciseId,
          muscleGroup,
          role: 'direct' as const,
        })),
        ...secondaryMuscles.map((muscleGroup) => ({
          exerciseId,
          muscleGroup,
          role: 'indirect' as const,
        })),
      ]);

      await addSlotAlternate(swapSlot.id, exerciseId);

      const customOption = { id: exerciseId, name: trimmedName };
      setCustomExerciseOptions((current) =>
        [...current, customOption].sort((left, right) =>
          left.name.localeCompare(right.name)
        )
      );
      setSelectedExerciseBySlot((current) => ({
        ...current,
        [swapSlot.id]: customOption,
      }));
      void fetchProgressionHint(exerciseId);

      resetCustomExerciseForm();
      setSwapSlotId(null);
    } catch (error) {
      showActionError(
        'Custom exercise failed',
        error,
        'Could not create custom exercise.'
      );
    } finally {
      setCreatingCustomExercise(false);
    }
  };

  const startWorkout = async () => {
    if (!template) {
      return;
    }

    setActionError(null);
    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const result = await createWorkoutSession({
        dayTemplateId: template.id,
        prsScore,
        bodyweightKg: bodyweightInput ? Number(bodyweightInput) : null,
        startedAtOverride: backdateIso ?? undefined,
      });
      setWorkoutId(result.workoutId);
      setStartedAt(backdateIso ?? nowIso);
      setElapsedStartAt(nowIso);
      setElapsedSeconds(0);
    } catch (error) {
      showActionError(
        'Could not start workout',
        error,
        'Unable to create workout session.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getSlotSets = (slotId: number, exerciseId: string) => {
    return loggedSets
      .filter((set) => set.slotId === slotId && set.exerciseId === exerciseId)
      .sort((left, right) => left.setOrder - right.setOrder);
  };

  const createDraftSet = async (slotId: number) => {
    if (!template) {
      return;
    }

    const slot = template.slots.find((candidate) => candidate.id === slotId);
    if (!slot) {
      return;
    }

    const selectedExercise = selectedExerciseBySlot[slot.id];
    try {
      setActionError(null);
      const isTimedSlot = slot.inputMode === 'timed';
      const mostRecentLoad = !isTimedSlot && selectedExercise
        ? await getMostRecentLoad(selectedExercise.id)
        : null;

      const draft: DraftSetInput = {
        loadKg:
          isTimedSlot
            ? '0'
            : mostRecentLoad !== null
              ? String(mostRecentLoad)
              : '',
        reps: '',
        effortLabel: null,
        isWarmup: false,
      };

      setDraftSet(slotId, draft);
    } catch (error) {
      showActionError(
        'Could not prepare set input',
        error,
        'Unable to load previous set defaults.'
      );
    }
  };

  const confirmSet = async (slotId: number) => {
    if (!workoutId || !template) {
      return;
    }

    const draft = draftSetsBySlotId[slotId];
    const exercise = selectedExerciseBySlot[slotId];
    const slot = template.slots.find((candidate) => candidate.id === slotId);

    if (!draft || !exercise || !slot || !draft.effortLabel) {
      return;
    }

    const reps = Number(draft.reps);
    const isTimedSlot = slot.inputMode === 'timed';
    const loadKg = isTimedSlot ? 0 : Number(draft.loadKg);
    if (!Number.isFinite(reps) || reps <= 0) {
      return;
    }

    if (!isTimedSlot && (!Number.isFinite(loadKg) || loadKg < 0)) {
      return;
    }

    try {
      setActionError(null);
      const editingSetId = editingSetBySlotId[slotId];

      if (editingSetId) {
        await updateSet({
          setId: editingSetId,
          reps,
          loadKg,
          effortLabel: draft.effortLabel,
          isWarmup: draft.isWarmup,
          notes: null,
        });

        setLoggedSets((current) =>
          current.map((set) =>
            set.id === editingSetId
              ? {
                  ...set,
                  reps,
                  loadKg,
                  effortLabel: draft.effortLabel as EffortLabel,
                  isWarmup: draft.isWarmup,
                }
              : set
          )
        );

        setEditingSetBySlotId((current) => {
          const next = { ...current };
          delete next[slotId];
          return next;
        });

        clearDraftSet(slotId);
        return;
      }

      const setOrder = getSlotSets(slotId, exercise.id).length + 1;

      const result = await logSet({
        workoutId,
        exerciseId: exercise.id,
        reps,
        loadKg,
        effortLabel: draft.effortLabel,
        isWarmup: draft.isWarmup,
        notes: null,
        loggedAtOverride: backdateIso ?? undefined,
      });

      setLoggedSets((current) => [
        ...current,
        {
          id: result.setId,
          slotId,
          exerciseId: exercise.id,
          reps,
          loadKg,
          effortLabel: draft.effortLabel as EffortLabel,
          isWarmup: draft.isWarmup,
          setOrder,
        },
      ]);

      clearDraftSet(slotId);
      const restSeconds = slot.restSeconds || defaultRestSeconds;
      startRestTimer(restSeconds);
      void cancelRestNotification(restNotificationId.current);
      scheduleRestNotification(restSeconds).then((id) => {
        restNotificationId.current = id;
      });
      await Haptics.selectionAsync();
    } catch (error) {
      showActionError(
        'Set save failed',
        error,
        'Could not save set. Your input is still on screen so you can retry.'
      );
    }
  };

  const openEditSet = (setToEdit: LocalLoggedSet) => {
    setDraftSet(setToEdit.slotId, {
      loadKg: String(setToEdit.loadKg),
      reps: String(setToEdit.reps),
      effortLabel: setToEdit.effortLabel,
      isWarmup: setToEdit.isWarmup,
    });

    setEditingSetBySlotId((current) => ({
      ...current,
      [setToEdit.slotId]: setToEdit.id,
    }));
  };

  const deleteLoggedSet = (setToDelete: LocalLoggedSet) => {
    Alert.alert(
      'Delete Set',
      `Delete Set ${setToDelete.setOrder} (${setToDelete.loadKg} kg x ${setToDelete.reps})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSet(setToDelete.id);
              setLoggedSets((current) =>
                current.filter((set) => set.id !== setToDelete.id)
              );
              // Clear draft if we were editing this set
              if (editingSetBySlotId[setToDelete.slotId] === setToDelete.id) {
                clearDraftSet(setToDelete.slotId);
                setEditingSetBySlotId((current) => {
                  const next = { ...current };
                  delete next[setToDelete.slotId];
                  return next;
                });
              }
            } catch (error) {
              showActionError('Delete failed', error, 'Could not delete set.');
            }
          },
        },
      ]
    );
  };

  const finishWorkout = async () => {
    if (!workoutId) {
      return;
    }

    if (loggedSets.length === 0) {
      Alert.alert('No sets logged', 'Log at least one set before finishing.');
      return;
    }

    setActionError(null);
    setSubmitting(true);
    try {
      await completeWorkoutSession({
        workoutId,
        notes: notes.trim().length > 0 ? notes.trim() : null,
      });
      clearSessionUiState();
      await new Promise((resolve) => setTimeout(resolve, 100));
      router.back();
    } catch (error) {
      showActionError(
        'Could not finish workout',
        error,
        'Unable to mark workout complete right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatClock = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
      secs
    ).padStart(2, '0')}`;
  };

  const elapsedLabel = formatClock(elapsedSeconds);

  const incompleteExerciseSlots = template
    ? template.slots.filter((slot) => {
        const selectedExerciseId =
          selectedExerciseBySlot[slot.id]?.id ?? slot.defaultExerciseId;
        return getSlotSets(slot.id, selectedExerciseId).length === 0;
      })
    : [];

  const completedSlots = template ? template.slots.length - incompleteExerciseSlots.length : 0;

  const swapSlot = useMemo(() => {
    if (!template || swapSlotId === null) {
      return null;
    }

    return template.slots.find((slot) => slot.id === swapSlotId) ?? null;
  }, [template, swapSlotId]);

  const swapOptions = useMemo(() => {
    if (!swapSlot) {
      return [];
    }

    const allOptions = [
      {
        id: swapSlot.defaultExerciseId,
        name: swapSlot.defaultExerciseName,
      },
      ...swapSlot.alternateExercises,
      ...customExerciseOptions,
    ];

    const seen = new Set<string>();
    return allOptions.filter((option) => {
      if (seen.has(option.id)) {
        return false;
      }
      seen.add(option.id);
      return true;
    });
  }, [customExerciseOptions, swapSlot]);

  const restRemainingRatio =
    restTimer.totalSeconds > 0
      ? restTimer.remainingSeconds / restTimer.totalSeconds
      : 0;
  const restFillColor =
    restRemainingRatio > 0.5
      ? theme.colors.accent
      : restRemainingRatio > 0.25
        ? theme.colors.warning
        : theme.colors.danger;

  if (loading || !template) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.dayName}>
            Day {template.dayNumber} - {template.dayName}
          </Text>
          {backdateIso ? (
            <View style={styles.backdateBanner}>
              <Text style={styles.backdateBannerText}>
                Logging for {new Date(backdateIso).toLocaleDateString()}
              </Text>
            </View>
          ) : null}
          {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.headerStatLabel}>ELAPSED</Text>
          <Text style={styles.headerElapsedValue}>{elapsedLabel}</Text>
          <Pressable
            onPress={() => setShowFinishFlow(true)}
            style={({ pressed }) => [styles.finishButton, pressed && styles.pressed]}
          >
            <Text style={styles.finishButtonText}>Finish</Text>
          </Pressable>
        </View>
      </View>

      {!workoutId ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.setupCard}>
            <Text style={styles.setupTitle}>Pre-workout check-in</Text>
            <Text style={styles.setupSubtitle}>
              Set recovery score and optional bodyweight, then start logging sets.
            </Text>
            <PrsInput value={prsScore} onChange={setPrsScore} />

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bodyweight (kg, optional)</Text>
              <TextInput
                keyboardType="decimal-pad"
                value={bodyweightInput}
                onChangeText={setBodyweightInput}
                placeholder="e.g. 82.5"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.textInput}
              />
            </View>

            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Today</Text>
              {template.slots.slice(0, 4).map((slot) => (
                <Text key={slot.id} style={styles.previewRow}>
                  {slot.slotOrder}. {slot.defaultExerciseName} (
                  {slot.targetSets} sets, {slot.inputMode === 'timed' ? 'timed' : `${slot.targetRepLow}-${slot.targetRepHigh} reps`})
                </Text>
              ))}
              {template.slots.length > 4 ? (
                <Text style={styles.previewRow}>+{template.slots.length - 4} more exercises</Text>
              ) : null}
            </View>

            <Pressable
              disabled={submitting}
              onPress={() => {
                void startWorkout();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                submitting && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Start Logging</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>
              {completedSlots}/{template.slots.length} exercises with at least one logged set
            </Text>
            <Text style={styles.progressSubtitle}>
              Tap any logged set to edit. Confirmed sets are already saved to device storage.
            </Text>
          </View>

          {template.slots.map((slot) => {
            const slotExercise = selectedExerciseBySlot[slot.id] ?? {
              id: slot.defaultExerciseId,
              name: slot.defaultExerciseName,
            };

            const slotSets = getSlotSets(slot.id, slotExercise.id);
            const setSummary = `${slotSets.length}/${slot.targetSets} sets done`;
            const draftSet = draftSetsBySlotId[slot.id];
            const progression = progressionByExercise[slotExercise.id];
            const isComplete = slotSets.length >= slot.targetSets;
            const isTimedSlot = slot.inputMode === 'timed';
            const targetLabel = isTimedSlot
              ? `${slot.targetSets} sets x duration`
              : `${slot.targetSets} sets x ${slot.targetRepLow}-${slot.targetRepHigh} reps`;

            return (
              <ExerciseCard
                key={slot.id}
                title={slotExercise.name}
                setSummary={setSummary}
                targetLabel={targetLabel}
                notes={slot.notes}
                expanded={expandedSlotIds.includes(slot.id)}
                completed={isComplete}
                accentColor={
                  isTimedSlot
                    ? theme.colors.info
                    : isComplete
                      ? theme.colors.accent
                      : theme.colors.borderFocus
                }
                onToggle={() => toggleSlotExpanded(slot.id)}
                onOpenSwap={() => setSwapSlotId(slot.id)}
                progressionHint={
                  progression
                    ? `Try ${progression.suggestedLoadKg.toFixed(1)} kg next`
                    : null
                }
              >
                <View style={styles.loggedSetList}>
                  {slotSets.map((set) => (
                    <Pressable
                      key={set.id}
                      onPress={() => openEditSet(set)}
                      onLongPress={() => deleteLoggedSet(set)}
                      delayLongPress={500}
                      style={({ pressed }) => [styles.loggedSetRow, pressed && styles.pressed]}
                    >
                      <Text style={styles.loggedSetText}>
                        Set {set.setOrder}: {isTimedSlot ? `${set.reps}s` : `${set.loadKg}kg x ${set.reps}`}{' '}
                        <Text
                          style={[
                            styles.loggedSetEffort,
                            { color: effortColorByLabel[set.effortLabel] },
                          ]}
                        >
                          [{set.effortLabel}]
                        </Text>
                        {set.isWarmup ? (
                          <Text style={styles.loggedSetWarmup}> warmup</Text>
                        ) : null}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {draftSet ? (
                  <SetRow
                    setNumber={slotSets.length + (editingSetBySlotId[slot.id] ? 0 : 1)}
                    value={draftSet}
                    inputMode={slot.inputMode}
                    intervalHintSeconds={slot.restSeconds}
                    onChange={(nextDraft) => setDraftSet(slot.id, nextDraft)}
                    onConfirm={() => {
                      void confirmSet(slot.id);
                    }}
                  />
                ) : (
                  <Pressable
                    onPress={() => {
                      void createDraftSet(slot.id);
                    }}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.secondaryButtonText}>Add Set</Text>
                  </Pressable>
                )}
              </ExerciseCard>
            );
          })}
        </ScrollView>
      )}

      {restTimer.totalSeconds > 0 ? (
        <View style={[styles.restTimerBar, { bottom: Math.max(10, insets.bottom) }]}>
          <View style={styles.restHeaderRow}>
            <Text style={styles.restTimeBig}>{formatClock(restTimer.remainingSeconds)}</Text>
            <View style={styles.restStatusBadge}>
              <Text style={styles.restStatusText}>
                {restTimer.isRunning ? 'RUNNING' : 'PAUSED'}
              </Text>
            </View>
          </View>
          <Text style={styles.restTimerText}>
            REST {restTimer.remainingSeconds}s / {restTimer.totalSeconds}s
          </Text>

          <View style={styles.restProgressTrack}>
            <View
              style={[
                styles.restProgressFill,
                {
                  width: `${Math.max(0, Math.min(1, restRemainingRatio)) * 100}%`,
                  backgroundColor: restFillColor,
                },
              ]}
            />
          </View>

          <View style={styles.restActions}>
            <Pressable
              onPress={() => {
                pauseRestTimer();
                void cancelRestNotification(restNotificationId.current);
                restNotificationId.current = null;
              }}
              style={({ pressed }) => [styles.restActionButton, pressed && styles.pressed]}
            >
              <Text style={styles.restActionText}>Pause</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                resetRestTimer();
                void cancelRestNotification(restNotificationId.current);
                restNotificationId.current = null;
              }}
              style={({ pressed }) => [styles.restActionButton, pressed && styles.pressed]}
            >
              <Text style={styles.restActionText}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                dismissRestTimer();
                void cancelRestNotification(restNotificationId.current);
                restNotificationId.current = null;
              }}
              style={({ pressed }) => [styles.restActionButton, pressed && styles.pressed]}
            >
              <Text style={styles.restActionText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {swapSlot ? (
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetDismissArea} onPress={() => setSwapSlotId(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Swap Exercise</Text>
            <Text style={styles.sheetSubtitle}>
              Choose an option for slot {swapSlot.slotOrder}.
            </Text>

            {swapOptions.map((option) => {
              const selected = selectedExerciseBySlot[swapSlot.id]?.id === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    const currentExerciseId = selectedExerciseBySlot[swapSlot.id]?.id;
                    const hasLoggedSetsForSlot = loggedSets.some(
                      (set) => set.slotId === swapSlot.id
                    );

                    if (
                      hasLoggedSetsForSlot &&
                      currentExerciseId &&
                      option.id !== currentExerciseId
                    ) {
                      const message =
                        'You cannot swap this exercise after logging sets for the slot.';
                      setActionError(message);
                      Alert.alert('Swap unavailable', message);
                      setSwapSlotId(null);
                      return;
                    }

                    setSelectedExerciseBySlot((current) => ({
                      ...current,
                      [swapSlot.id]: { id: option.id, name: option.name },
                    }));
                    setSwapSlotId(null);
                    void fetchProgressionHint(option.id);
                  }}
                  style={({ pressed }) => [
                    styles.sheetOption,
                    selected && styles.sheetOptionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.sheetOptionText, selected && styles.sheetOptionTextSelected]}>
                    {option.name}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => setShowCustomExerciseForm((current) => !current)}
              style={({ pressed }) => [styles.sheetCustomButton, pressed && styles.pressed]}
            >
              <Text style={styles.sheetCustomButtonText}>+ Add Custom Exercise</Text>
            </Pressable>

            {showCustomExerciseForm ? (
              <View style={styles.customFormCard}>
                <Text style={styles.customFormLabel}>Exercise Name</Text>
                <TextInput
                  value={customExerciseName}
                  onChangeText={setCustomExerciseName}
                  placeholder="e.g. Hyperextension (Glute Focus)"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={styles.customFormInput}
                />

                <Text style={styles.customFormLabel}>Category</Text>
                <View style={styles.customCategoryRow}>
                  {customExerciseCategories.map((category) => {
                    const selected = customExerciseCategory === category;
                    return (
                      <Pressable
                        key={category}
                        onPress={() => setCustomExerciseCategory(category)}
                        style={({ pressed }) => [
                          styles.customCategoryButton,
                          selected && styles.customCategoryButtonSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.customCategoryText,
                            selected && styles.customCategoryTextSelected,
                          ]}
                        >
                          {category}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.customFormLabel}>Primary Muscles (Direct)</Text>
                <View style={styles.customMuscleGrid}>
                  {muscleGroups.map((muscleGroup) => {
                    const selected = customPrimaryMuscles.includes(muscleGroup.id);
                    return (
                      <Pressable
                        key={`primary-${muscleGroup.id}`}
                        onPress={() => toggleMuscleSelection(muscleGroup.id, setCustomPrimaryMuscles)}
                        style={({ pressed }) => [
                          styles.customMuscleButton,
                          selected && styles.customMuscleButtonSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.customMuscleText,
                            selected && styles.customMuscleTextSelected,
                          ]}
                        >
                          {muscleGroup.displayName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.customFormLabel}>Secondary Muscles (Indirect)</Text>
                <View style={styles.customMuscleGrid}>
                  {muscleGroups.map((muscleGroup) => {
                    const selected = customSecondaryMuscles.includes(muscleGroup.id);
                    return (
                      <Pressable
                        key={`secondary-${muscleGroup.id}`}
                        onPress={() => toggleMuscleSelection(muscleGroup.id, setCustomSecondaryMuscles)}
                        style={({ pressed }) => [
                          styles.customMuscleButton,
                          selected && styles.customMuscleButtonSecondarySelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.customMuscleText,
                            selected && styles.customMuscleTextSelected,
                          ]}
                        >
                          {muscleGroup.displayName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  onPress={() => {
                    void createCustomExerciseForSwapSlot();
                  }}
                  disabled={creatingCustomExercise}
                  style={({ pressed }) => [
                    styles.sheetCreateButton,
                    creatingCustomExercise && styles.sheetCreateButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.sheetCreateButtonText}>
                    {creatingCustomExercise ? 'Creating...' : 'Create & Select'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {showFinishFlow ? (
        <View style={styles.sheetBackdrop}>
          <Pressable
            style={styles.sheetDismissArea}
            onPress={() => setShowFinishFlow(false)}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(14, insets.bottom) }]}>
            <Text style={styles.sheetTitle}>Finish Workout</Text>
            <Text style={styles.summaryText}>Duration: {elapsedLabel}</Text>
            <Text style={styles.summaryText}>Total sets: {loggedSets.length}</Text>
            <Text style={styles.summaryText}>
              Exercises completed: {completedSlots}/{template.slots.length}
            </Text>

            {incompleteExerciseSlots.length > 0 ? (
              <Text style={styles.warningText}>
                Missing sets: {incompleteExerciseSlots.map((slot) => slot.defaultExerciseName).join(', ')}
              </Text>
            ) : null}

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional workout notes"
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              style={[styles.textInput, styles.notesInput]}
            />

            <Pressable
              disabled={submitting}
              onPress={() => {
                void finishWorkout();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                submitting && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Save Workout</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.bg1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  dayName: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.xl,
    fontWeight: '900',
  },
  headerStatLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerElapsedValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.lg,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: '700',
    maxWidth: 260,
    fontSize: theme.fontSize.sm,
  },
  finishButton: {
    minHeight: 36,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  finishButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
    letterSpacing: 0.3,
  },
  backdateBanner: {
    minHeight: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: '#3a2a12',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  backdateBannerText: {
    color: theme.colors.warning,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  scrollContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    paddingBottom: 148,
    backgroundColor: theme.colors.bg1,
  },
  setupCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  setupTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
    fontSize: theme.fontSize.xl,
  },
  setupSubtitle: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    lineHeight: 18,
  },
  progressCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: 6,
  },
  progressTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  progressSubtitle: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    lineHeight: 17,
  },
  inputGroup: {
    gap: theme.spacing.xs,
  },
  inputLabel: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  textInput: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
  },
  notesInput: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  previewCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    padding: 10,
    gap: 4,
  },
  previewTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
    letterSpacing: 0.2,
  },
  previewRow: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    lineHeight: 17,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: theme.colors.bg3,
  },
  primaryButtonText: {
    color: '#03241d',
    fontSize: theme.fontSize.md,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
    letterSpacing: 0.2,
  },
  loggedSetList: {
    gap: 6,
  },
  loggedSetRow: {
    minHeight: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bg1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  loggedSetText: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  loggedSetEffort: {
    fontWeight: '800',
  },
  loggedSetWarmup: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  restTimerBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 10,
    gap: 8,
  },
  restHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  restTimerText: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  restTimeBig: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
    fontSize: theme.fontSize.xxl,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  restStatusBadge: {
    minHeight: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  restStatusText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  restProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.bg1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  restProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
  },
  restActions: {
    flexDirection: 'row',
    gap: 8,
  },
  restActionButton: {
    minHeight: 36,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: theme.colors.bg3,
  },
  restActionText: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheetDismissArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  sheet: {
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomWidth: 0,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  sheetTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.xl,
    fontWeight: '800',
  },
  sheetSubtitle: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
  sheetOption: {
    minHeight: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: theme.colors.bg3,
  },
  sheetOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentDim,
  },
  sheetOptionText: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
  },
  sheetOptionTextSelected: {
    color: theme.colors.accent,
  },
  sheetCustomButton: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  sheetCustomButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
  },
  customFormCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    padding: 10,
    gap: 8,
  },
  customFormLabel: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  customFormInput: {
    minHeight: 42,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    color: theme.colors.textPrimary,
    paddingHorizontal: 10,
    fontWeight: '700',
  },
  customCategoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customCategoryButton: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  customCategoryButtonSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentDim,
  },
  customCategoryText: {
    color: theme.colors.textSecondary,
    fontWeight: '800',
    fontSize: theme.fontSize.xs,
  },
  customCategoryTextSelected: {
    color: theme.colors.accent,
  },
  customMuscleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  customMuscleButton: {
    minHeight: 34,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  customMuscleButtonSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentDim,
  },
  customMuscleButtonSecondarySelected: {
    borderColor: theme.colors.warning,
    backgroundColor: '#3d2a10',
  },
  customMuscleText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  customMuscleTextSelected: {
    color: theme.colors.textPrimary,
  },
  sheetCreateButton: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCreateButtonDisabled: {
    backgroundColor: theme.colors.bg3,
  },
  sheetCreateButtonText: {
    color: '#03241d',
    fontWeight: '900',
    fontSize: theme.fontSize.sm,
  },
  summaryText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  warningText: {
    color: theme.colors.warning,
    fontWeight: '700',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.7,
  },
});
