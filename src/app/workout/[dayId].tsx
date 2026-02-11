import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from '../../components/ExerciseCard';
import { PrsInput } from '../../components/PrsInput';
import { SetRow } from '../../components/SetRow';
import { theme } from '../../constants/theme';
import {
  completeWorkoutSession,
  createWorkoutSession,
  getActiveWorkout,
  getDayTemplateByDayNumber,
  getMostRecentLoad,
  getWorkoutSets,
  logSet,
  updateSet,
} from '../../db/queries';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWorkoutStore, type DraftSetInput } from '../../stores/workoutStore';
import type {
  DayTemplateWithSlots,
  EffortLabel,
  ProgressionSuggestion,
} from '../../types';
import { getProgressionSuggestion } from '../../utils/progressionEngine';

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

export default function ActiveWorkoutScreen() {
  const params = useLocalSearchParams<{ dayId: string; workoutId?: string }>();
  const router = useRouter();

  const dayNumber = Number(params.dayId || '1');
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

  useEffect(() => {
    return () => {
      clearSessionUiState();
    };
  }, [clearSessionUiState]);

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

        let resolvedWorkoutId = workoutId;
        const activeWorkout = await getActiveWorkout();

        if (
          activeWorkout &&
          activeWorkout.dayNumber === loadedTemplate.dayNumber &&
          (!resolvedWorkoutId || resolvedWorkoutId === activeWorkout.workoutId)
        ) {
          resolvedWorkoutId = activeWorkout.workoutId;
          setWorkoutId(activeWorkout.workoutId);
          setStartedAt(activeWorkout.startedAt);
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
  }, [dayNumber, workoutId]);

  useEffect(() => {
    if (!startedAt) {
      return;
    }

    const interval = setInterval(() => {
      const nowMs = Date.now();
      const startedAtMs = new Date(startedAt).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((nowMs - startedAtMs) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

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

  const startWorkout = async () => {
    if (!template) {
      return;
    }

    setActionError(null);
    setSubmitting(true);
    try {
      const result = await createWorkoutSession({
        dayTemplateId: template.id,
        prsScore,
        bodyweightKg: bodyweightInput ? Number(bodyweightInput) : null,
      });
      setWorkoutId(result.workoutId);
      setStartedAt(new Date().toISOString());
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
      const mostRecentLoad = selectedExercise
        ? await getMostRecentLoad(selectedExercise.id)
        : null;

      const draft: DraftSetInput = {
        loadKg: mostRecentLoad !== null ? String(mostRecentLoad) : '',
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
    const loadKg = Number(draft.loadKg);
    if (!Number.isFinite(reps) || reps <= 0) {
      return;
    }

    if (!Number.isFinite(loadKg) || loadKg < 0) {
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
      startRestTimer(slot.restSeconds || defaultRestSeconds);
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
      router.replace('/');
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

  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)}:${String(
    elapsedSeconds % 60
  ).padStart(2, '0')}`;

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
    ];

    const seen = new Set<string>();
    return allOptions.filter((option) => {
      if (seen.has(option.id)) {
        return false;
      }
      seen.add(option.id);
      return true;
    });
  }, [swapSlot]);

  const restProgress =
    restTimer.totalSeconds > 0
      ? (restTimer.totalSeconds - restTimer.remainingSeconds) / restTimer.totalSeconds
      : 0;

  if (loading || !template) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.dayTag}>Day {template.dayNumber}</Text>
          <Text style={styles.dayName}>{template.dayName}</Text>
          <View style={styles.headerStatRow}>
            <View style={styles.headerStatPill}>
              <Text style={styles.headerStatLabel}>Elapsed</Text>
              <Text style={styles.headerStatValue}>{elapsedLabel}</Text>
            </View>
            <View style={styles.headerStatPill}>
              <Text style={styles.headerStatLabel}>Sets</Text>
              <Text style={styles.headerStatValue}>{loggedSets.length}</Text>
            </View>
          </View>
          {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
        </View>

        <Pressable onPress={() => setShowFinishFlow(true)} style={styles.finishButton}>
          <Text style={styles.finishButtonText}>Finish</Text>
        </Pressable>
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
                  {slot.slotOrder}. {slot.defaultExerciseName} ({slot.targetSets} sets, {slot.targetRepLow}-{slot.targetRepHigh} reps)
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
              style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
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

            return (
              <ExerciseCard
                key={slot.id}
                title={slotExercise.name}
                setSummary={setSummary}
                targetLabel={`${slot.targetSets} sets x ${slot.targetRepLow}-${slot.targetRepHigh} reps`}
                notes={slot.notes}
                expanded={expandedSlotIds.includes(slot.id)}
                completed={isComplete}
                onToggle={() => toggleSlotExpanded(slot.id)}
                onOpenSwap={() => setSwapSlotId(slot.id)}
                progressionHint={
                  progression
                    ? `Progress hint: try ${progression.suggestedLoadKg.toFixed(1)} kg`
                    : null
                }
              >
                <View style={styles.loggedSetList}>
                  {slotSets.map((set) => (
                    <Pressable
                      key={set.id}
                      onPress={() => openEditSet(set)}
                      style={styles.loggedSetRow}
                    >
                      <Text style={styles.loggedSetText}>
                        Set {set.setOrder}: {set.loadKg} kg x {set.reps} | {set.effortLabel}
                        {set.isWarmup ? ' | warmup' : ''}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {draftSet ? (
                  <SetRow
                    setNumber={slotSets.length + (editingSetBySlotId[slot.id] ? 0 : 1)}
                    value={draftSet}
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
                    style={styles.secondaryButton}
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
        <View style={styles.restTimerBar}>
          <View style={styles.restHeaderRow}>
            <Text style={styles.restTimerText}>
              Rest: {restTimer.remainingSeconds}s / {restTimer.totalSeconds}s
            </Text>
            <View style={styles.restStatusBadge}>
              <Text style={styles.restStatusText}>
                {restTimer.isRunning ? 'RUNNING' : 'PAUSED'}
              </Text>
            </View>
          </View>

          <View style={styles.restProgressTrack}>
            <View
              style={[
                styles.restProgressFill,
                { width: `${Math.max(0, Math.min(1, restProgress)) * 100}%` },
              ]}
            />
          </View>

          <View style={styles.restActions}>
            <Pressable onPress={pauseRestTimer} style={styles.restActionButton}>
              <Text style={styles.restActionText}>Pause</Text>
            </Pressable>
            <Pressable onPress={resetRestTimer} style={styles.restActionButton}>
              <Text style={styles.restActionText}>Reset</Text>
            </Pressable>
            <Pressable onPress={dismissRestTimer} style={styles.restActionButton}>
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
                  style={[styles.sheetOption, selected && styles.sheetOptionSelected]}
                >
                  <Text style={[styles.sheetOptionText, selected && styles.sheetOptionTextSelected]}>
                    {option.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {showFinishFlow ? (
        <View style={styles.sheetBackdrop}>
          <Pressable
            style={styles.sheetDismissArea}
            onPress={() => setShowFinishFlow(false)}
          />
          <View style={styles.sheet}>
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
              style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            >
              <Text style={styles.primaryButtonText}>Save Workout</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#243551',
    backgroundColor: '#0a1220',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  dayTag: {
    color: '#b8d4ff',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontSize: 11,
    fontWeight: '800',
  },
  dayName: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  headerStatRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  headerStatPill: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#324d75',
    backgroundColor: '#13233a',
    justifyContent: 'center',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerStatLabel: {
    color: '#a8c6ee',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  headerStatValue: {
    color: '#ebf4ff',
    fontSize: 13,
    fontWeight: '900',
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: '700',
    marginTop: 4,
    maxWidth: 280,
  },
  finishButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4f7ab0',
    backgroundColor: '#1d2f4a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  finishButtonText: {
    color: '#d5e6ff',
    fontWeight: '900',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  scrollContent: {
    padding: 12,
    gap: 10,
    paddingBottom: 148,
  },
  setupCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2c4162',
    backgroundColor: '#111a2b',
    padding: 14,
    gap: 14,
  },
  setupTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
    fontSize: 18,
  },
  setupSubtitle: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
  },
  progressCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#365377',
    backgroundColor: '#122036',
    padding: 12,
    gap: 6,
  },
  progressTitle: {
    color: '#e4efff',
    fontWeight: '800',
    fontSize: 13,
  },
  progressSubtitle: {
    color: '#9bb8dd',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 17,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  textInput: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#344a6a',
    backgroundColor: '#0d1625',
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
  },
  notesInput: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  previewCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#0c1422',
    padding: 10,
    gap: 4,
  },
  previewTitle: {
    color: '#d9e8ff',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  previewRow: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 17,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#3f5269',
  },
  primaryButtonText: {
    color: '#06170f',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#406491',
    backgroundColor: '#172945',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#d7e8ff',
    fontWeight: '900',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  loggedSetList: {
    gap: 6,
  },
  loggedSetRow: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#0f1b2f',
    borderWidth: 1,
    borderColor: '#2e4568',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  loggedSetText: {
    color: '#c5d6ed',
    fontWeight: '700',
    fontSize: 13,
  },
  restTimerBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    borderRadius: 12,
    backgroundColor: '#10243d',
    borderWidth: 1,
    borderColor: '#3f689b',
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
    color: '#d8e8ff',
    fontWeight: '900',
  },
  restStatusBadge: {
    minHeight: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4c7ab4',
    backgroundColor: '#173455',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  restStatusText: {
    color: '#d6e8ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  restProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1f3654',
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4d7bb5',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#173455',
  },
  restActionText: {
    color: '#d8e8ff',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheetDismissArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#334c72',
    borderBottomWidth: 0,
    backgroundColor: '#101a2b',
    padding: 14,
    gap: 10,
  },
  sheetTitle: {
    color: theme.colors.textPrimary,
    fontSize: 19,
    fontWeight: '900',
  },
  sheetSubtitle: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  sheetOption: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#355274',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#16253d',
  },
  sheetOptionSelected: {
    borderColor: '#4aa987',
    backgroundColor: '#153c30',
  },
  sheetOptionText: {
    color: '#dce9ff',
    fontWeight: '800',
  },
  sheetOptionTextSelected: {
    color: '#b6f2d7',
  },
  summaryText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  warningText: {
    color: theme.colors.warning,
    fontWeight: '700',
    lineHeight: 20,
  },
});
