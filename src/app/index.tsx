import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../constants/theme';
import {
  getActiveWorkout,
  getAdherenceStats,
  getFirstWorkoutAnchor,
  getNextDayTemplate,
  getWeekStats,
  listProgramDayTemplates,
} from '../db/queries';
import type {
  ActiveWorkoutSummary,
  DayTemplateWithSlots,
  TrainingPhaseInfo,
} from '../types';
import { getRollingWeekWindow } from '../utils/rollingWeek';
import { getTrainingPhase } from '../utils/trainingPhase';

interface QuickLinkItem {
  id: string;
  title: string;
  route: '/progress/volume' | '/workout/history' | '/progress/strength' | '/settings';
}

const quickLinks: QuickLinkItem[] = [
  { id: 'volume', title: 'Volume', route: '/progress/volume' },
  { id: 'history', title: 'History', route: '/workout/history' },
  { id: 'strength', title: 'Strength', route: '/progress/strength' },
  { id: 'settings', title: 'Settings', route: '/settings' },
];

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface AdherenceStats {
  completed: number;
  planned: number;
  percentage: number;
  weeklyBreakdown: { weekStartIso: string; count: number }[];
}

function shortExerciseName(name: string): string {
  return name
    .replace('Barbell ', '')
    .replace('Dumbbell ', '')
    .replace('Machine ', '')
    .replace('(Glute Focus)', '');
}

function toEndOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toLocalNoon(date: Date): Date {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

export default function HomeScreen() {
  const router = useRouter();
  const pulse = useRef(new Animated.Value(1)).current;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutSummary | null>(null);
  const [nextDayTemplate, setNextDayTemplate] = useState<DayTemplateWithSlots | null>(null);
  const [dayTemplates, setDayTemplates] = useState<DayTemplateWithSlots[]>([]);
  const [weekLabel, setWeekLabel] = useState('Week 0');
  const [weekRangeLabel, setWeekRangeLabel] = useState('');
  const [weekStats, setWeekStats] = useState({ workoutsThisWeek: 0, setsThisWeek: 0 });
  const [adherenceStats, setAdherenceStats] = useState<AdherenceStats>({
    completed: 0,
    planned: 0,
    percentage: 0,
    weeklyBreakdown: [],
  });
  const [trainingAgeWeeks, setTrainingAgeWeeks] = useState<number | null>(null);
  const [trainingPhaseInfo, setTrainingPhaseInfo] = useState<TrainingPhaseInfo | null>(
    null
  );
  const [isTrainingPhaseExpanded, setIsTrainingPhaseExpanded] = useState(false);
  const [showBackdatePicker, setShowBackdatePicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [pendingBackdateIso, setPendingBackdateIso] = useState<string | null>(null);
  const [backdateDate, setBackdateDate] = useState(() => {
    const value = new Date();
    value.setDate(value.getDate() - 1);
    value.setHours(12, 0, 0, 0);
    return value;
  });

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.25,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => {
      animation.stop();
    };
  }, [pulse]);

  const clampBackdate = useCallback(
    (value: Date) => {
      const normalized = toLocalNoon(value);
      const maxDate = toEndOfDay(new Date());

      if (normalized.getTime() > maxDate.getTime()) {
        return toLocalNoon(maxDate);
      }

      return normalized;
    },
    []
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [active, nextTemplate, templates, anchor] = await Promise.all([
        getActiveWorkout(),
        getNextDayTemplate(),
        listProgramDayTemplates(),
        getFirstWorkoutAnchor(),
      ]);

      setActiveWorkout(active);
      setNextDayTemplate(nextTemplate);
      setDayTemplates(templates);

      const nowIso = new Date().toISOString();
      const weekWindow = getRollingWeekWindow(nowIso, anchor ?? nowIso);
      const start = new Date(weekWindow.startIso).toLocaleDateString();
      const end = new Date(weekWindow.endIso).toLocaleDateString();
      const plannedPerWeek = Math.max(1, templates.length || 6);
      const adherenceWindowStartIso = new Date(
        new Date(weekWindow.startIso).getTime() - 3 * ONE_WEEK_MS
      ).toISOString();

      setWeekLabel(`Week ${weekWindow.weekNumber + 1}`);
      setWeekRangeLabel(`${start} - ${end}`);

      const [stats, adherence] = await Promise.all([
        getWeekStats(weekWindow.startIso, weekWindow.endIso),
        getAdherenceStats(
          adherenceWindowStartIso,
          weekWindow.endIso,
          plannedPerWeek
        ),
      ]);
      setWeekStats(stats);
      setAdherenceStats(adherence);

      if (anchor) {
        const weeksTraining = Math.max(
          0,
          (Date.now() - new Date(anchor).getTime()) / ONE_WEEK_MS
        );
        setTrainingAgeWeeks(weeksTraining);
        setTrainingPhaseInfo(getTrainingPhase(weeksTraining));
      } else {
        setTrainingAgeWeeks(null);
        setTrainingPhaseInfo(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const dayPickerOptions = useMemo(() => {
    if (dayTemplates.length > 0) {
      return dayTemplates;
    }

    return nextDayTemplate ? [nextDayTemplate] : [];
  }, [dayTemplates, nextDayTemplate]);

  const defaultDayNumber = nextDayTemplate?.dayNumber ?? dayPickerOptions[0]?.dayNumber ?? 1;

  const startButtonLabel = useMemo(
    () => (activeWorkout ? 'Resume Workout' : 'Start Workout'),
    [activeWorkout]
  );

  const nextWorkoutLabel = activeWorkout
    ? `Day ${activeWorkout.dayNumber} - ${activeWorkout.dayName}`
    : `Day ${nextDayTemplate?.dayNumber ?? 1} - ${nextDayTemplate?.dayName ?? 'Lower A'}`;

  const nextTemplateForSummary =
    (activeWorkout
      ? dayTemplates.find((day) => day.dayNumber === activeWorkout.dayNumber)
      : nextDayTemplate) ?? nextDayTemplate;

  const nextExerciseSummary = nextTemplateForSummary
    ? nextTemplateForSummary.slots
        .slice(0, 4)
        .map((slot) => shortExerciseName(slot.defaultExerciseName))
        .join(' • ')
    : 'No exercises loaded';

  const quickLinkPreview = useMemo(
    () => ({
      volume: `${weekStats.setsThisWeek}`,
      history: `${weekStats.workoutsThisWeek}`,
      strength: activeWorkout ? 'LIVE' : 'e1RM',
      settings: 'LOCAL',
    }),
    [activeWorkout, weekStats]
  );

  const adherenceColor =
    adherenceStats.percentage >= 80
      ? theme.colors.accent
      : adherenceStats.percentage >= 60
        ? theme.colors.warning
        : theme.colors.danger;

  const adherenceBarMax = useMemo(() => {
    const weeklyMax = Math.max(
      1,
      ...adherenceStats.weeklyBreakdown.map((entry) => entry.count)
    );
    const plannedPerWeek = adherenceStats.weeklyBreakdown.length > 0
      ? adherenceStats.planned / adherenceStats.weeklyBreakdown.length
      : 1;
    return Math.max(weeklyMax, plannedPerWeek);
  }, [adherenceStats.planned, adherenceStats.weeklyBreakdown]);

  const phaseBorderColor = trainingPhaseInfo
    ? trainingPhaseInfo.phase === 'neural'
      ? theme.colors.info
      : trainingPhaseInfo.phase === 'transition'
        ? theme.colors.warning
        : theme.colors.accent
    : theme.colors.borderFocus;

  const handleStartPress = () => {
    if (activeWorkout) {
      router.push({
        pathname: '/workout/[dayId]',
        params: {
          dayId: String(activeWorkout.dayNumber),
          workoutId: activeWorkout.workoutId,
        },
      });
      return;
    }

    if (dayPickerOptions.length === 0) {
      return;
    }

    setPendingBackdateIso(null);
    setShowDayPicker(true);
  };

  const openBackdatePicker = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    setBackdateDate(clampBackdate(yesterday));
    setShowBackdatePicker(true);
  };

  const confirmBackdateSelection = () => {
    setPendingBackdateIso(clampBackdate(backdateDate).toISOString());
    setShowBackdatePicker(false);
    setShowDayPicker(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void onRefresh();
            }}
            tintColor={theme.colors.accent}
          />
        }
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroProgram}>HYBRID BODYBUILDING 2.0</Text>
          <Text style={styles.heroWeekNumber}>{weekLabel.replace('Week ', '')}</Text>
          <Text style={styles.heroWeekLabel}>{weekLabel.toUpperCase()}</Text>
          <Text style={styles.heroRange}>{weekRangeLabel}</Text>
        </View>

        <View style={[styles.phaseCard, { borderLeftColor: phaseBorderColor }]}>
          <Text style={styles.phaseTag}>TRAINING PHASE</Text>
          {trainingPhaseInfo ? (
            <>
              <Text style={styles.phaseTitle}>{trainingPhaseInfo.title}</Text>
              <Text style={styles.phaseWeekLabel}>
                Week {Math.floor((trainingAgeWeeks ?? 0) + 1)} of training
              </Text>
              <Text
                style={styles.phaseDescription}
                numberOfLines={isTrainingPhaseExpanded ? undefined : 2}
              >
                {trainingPhaseInfo.description}
              </Text>
              <Pressable
                onPress={() =>
                  setIsTrainingPhaseExpanded((current) => !current)
                }
                style={({ pressed }) => [styles.phaseReadMore, pressed && styles.pressed]}
              >
                <Text style={styles.phaseReadMoreText}>
                  {isTrainingPhaseExpanded ? 'Show less' : 'Read more'}
                </Text>
              </Pressable>
              {isTrainingPhaseExpanded ? (
                <Text style={styles.phaseCitation}>
                  Based on: {trainingPhaseInfo.citation}. Approximate phases -
                  individual timelines vary.
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.phaseDescription}>
              Complete your first workout to unlock a training-phase context.
            </Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>WORKOUTS THIS WEEK</Text>
            <Text style={styles.statValue}>{weekStats.workoutsThisWeek}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>SETS THIS WEEK</Text>
            <Text style={styles.statValue}>{weekStats.setsThisWeek}</Text>
          </View>
        </View>

        <View style={styles.adherenceCard}>
          <Text style={styles.adherenceTag}>ADHERENCE</Text>
          <Text style={[styles.adherenceValue, { color: adherenceColor }]}>
            {adherenceStats.percentage.toFixed(0)}%
          </Text>
          <Text style={styles.adherenceSubtitle}>
            {adherenceStats.completed} of {adherenceStats.planned} planned sessions
            {' '} (last 4 weeks)
          </Text>
          {adherenceStats.percentage < 80 ? (
            <Text style={styles.adherenceNote}>
              Below 80% attendance is associated with reduced strength gains in novices
              (Colquhoun et al., 2017).
            </Text>
          ) : null}

          <View style={styles.adherenceBarsRow}>
            {adherenceStats.weeklyBreakdown.map((entry, index) => {
              const fillRatio = entry.count / adherenceBarMax;
              return (
                <View key={`${entry.weekStartIso}-${index}`} style={styles.adherenceBarColumn}>
                  <Text style={styles.adherenceBarCount}>{entry.count}</Text>
                  <View style={styles.adherenceBarTrack}>
                    <View
                      style={[
                        styles.adherenceBarFill,
                        {
                          height: `${Math.max(8, Math.round(fillRatio * 100))}%`,
                          backgroundColor: adherenceColor,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.adherenceBarLabel}>W{index + 1}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.nextCard}>
          <View style={styles.nextHeaderRow}>
            <Text style={styles.nextTitle}>NEXT WORKOUT</Text>
            <View style={styles.statusChip}>
              <Animated.View
                style={[
                  styles.statusDot,
                  activeWorkout ? styles.statusDotActive : styles.statusDotReady,
                  { transform: [{ scale: pulse }] },
                ]}
              />
              <Text style={styles.statusText}>{activeWorkout ? 'IN PROGRESS' : 'READY'}</Text>
            </View>
          </View>
          <Text style={styles.nextWorkoutLabel}>{nextWorkoutLabel}</Text>
          <Text numberOfLines={1} style={styles.nextSummary}>
            {nextExerciseSummary}
          </Text>
        </View>

        <Pressable
          onPress={handleStartPress}
          style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
        >
          <Text style={styles.startButtonText}>{startButtonLabel}</Text>
        </Pressable>

        {!activeWorkout ? (
          <Pressable
            onPress={openBackdatePicker}
            style={({ pressed }) => [styles.backdateButton, pressed && styles.pressed]}
          >
            <Text style={styles.backdateButtonText}>Log Past Workout</Text>
          </Pressable>
        ) : null}

        <View style={styles.quickGrid}>
          {quickLinks.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(item.route)}
              style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
            >
              <Text style={styles.quickValue}>{quickLinkPreview[item.id as keyof typeof quickLinkPreview]}</Text>
              <Text style={styles.quickTitle}>{item.title}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {showBackdatePicker ? (
        <View style={styles.sheetBackdrop}>
          <Pressable
            style={styles.sheetDismissArea}
            onPress={() => setShowBackdatePicker(false)}
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Pick Date</Text>
            <Text style={styles.sheetSubtitle}>Choose a past date for this workout.</Text>
            <DateTimePicker
              value={backdateDate}
              mode="date"
              maximumDate={toEndOfDay(new Date())}
              onChange={(_, selectedDate) => {
                if (!selectedDate) {
                  return;
                }
                setBackdateDate(clampBackdate(selectedDate));
              }}
            />
            <View style={styles.sheetActionsRow}>
              <Pressable
                onPress={() => setShowBackdatePicker(false)}
                style={({ pressed }) => [
                  styles.sheetActionButton,
                  styles.secondarySheetButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondarySheetButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmBackdateSelection}
                style={({ pressed }) => [
                  styles.sheetActionButton,
                  styles.primarySheetButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primarySheetButtonText}>Pick Workout Day</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {showDayPicker ? (
        <View style={styles.sheetBackdrop}>
          <Pressable
            style={styles.sheetDismissArea}
            onPress={() => {
              setShowDayPicker(false);
              setPendingBackdateIso(null);
            }}
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Choose Workout Day</Text>
            <Text style={styles.sheetSubtitle}>
              {pendingBackdateIso
                ? `Logging for ${new Date(pendingBackdateIso).toLocaleDateString()}`
                : `Default is Day ${defaultDayNumber}.`}
            </Text>

            {dayPickerOptions.map((day) => (
              <Pressable
                key={day.id}
                onPress={() => {
                  setShowDayPicker(false);
                  router.push({
                    pathname: '/workout/[dayId]',
                    params: pendingBackdateIso
                      ? {
                          dayId: String(day.dayNumber),
                          backdateIso: pendingBackdateIso,
                        }
                      : {
                          dayId: String(day.dayNumber),
                        },
                  });
                  setPendingBackdateIso(null);
                }}
                style={({ pressed }) => [
                  styles.sheetOption,
                  day.dayNumber === defaultDayNumber && styles.sheetOptionDefault,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.sheetOptionText}>
                  Day {day.dayNumber} - {day.dayName}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bg1,
  },
  heroCard: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  heroProgram: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroWeekNumber: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.hero,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 40,
  },
  heroWeekLabel: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroRange: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  phaseCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: 4,
  },
  phaseTag: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  phaseTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.lg,
    fontWeight: '800',
  },
  phaseWeekLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  phaseDescription: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    lineHeight: 18,
  },
  phaseReadMore: {
    alignSelf: 'flex-start',
    minHeight: 28,
    justifyContent: 'center',
    paddingRight: 8,
  },
  phaseReadMoreText: {
    color: theme.colors.info,
    fontSize: theme.fontSize.sm,
    fontWeight: '800',
  },
  phaseCitation: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.xxl,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  adherenceCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  adherenceTag: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  adherenceValue: {
    fontSize: theme.fontSize.hero,
    lineHeight: 40,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  adherenceSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  adherenceNote: {
    color: theme.colors.warning,
    fontSize: theme.fontSize.xs,
    lineHeight: 16,
    marginTop: 2,
  },
  adherenceBarsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  adherenceBarColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  adherenceBarCount: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  adherenceBarTrack: {
    width: '100%',
    maxWidth: 34,
    height: 44,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  adherenceBarFill: {
    width: '100%',
    minHeight: 8,
    borderTopLeftRadius: theme.radius.sm,
    borderTopRightRadius: theme.radius.sm,
  },
  adherenceBarLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  nextCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  nextHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg3,
    paddingHorizontal: 10,
    minHeight: 28,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusDotReady: {
    backgroundColor: theme.colors.accent,
  },
  statusDotActive: {
    backgroundColor: theme.colors.info,
  },
  statusText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  nextWorkoutLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.xl,
    fontWeight: '800',
  },
  nextSummary: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    lineHeight: 18,
  },
  startButton: {
    minHeight: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#03241d',
    fontSize: theme.fontSize.lg,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  backdateButton: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdateButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
    letterSpacing: 0.3,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  quickCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    minHeight: 82,
    padding: theme.spacing.md,
    justifyContent: 'center',
    gap: 3,
  },
  quickValue: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.lg,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.4,
  },
  quickTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
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
    fontSize: theme.fontSize.sm,
  },
  sheetActionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  sheetActionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  primarySheetButton: {
    backgroundColor: theme.colors.accent,
  },
  primarySheetButtonText: {
    color: '#03241d',
    fontWeight: '900',
    fontSize: theme.fontSize.sm,
  },
  secondarySheetButton: {
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
  },
  secondarySheetButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
  },
  sheetOption: {
    minHeight: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.bg3,
  },
  sheetOptionDefault: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentDim,
  },
  sheetOptionText: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  dayPickerCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#304767',
    backgroundColor: '#0f192a',
    padding: 12,
    gap: 10,
  },
  dayPickerToggle: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#39557a',
    backgroundColor: '#122138',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dayPickerToggleText: {
    color: '#cce0fa',
    fontWeight: '800',
    fontSize: 13,
  },
  dayPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayPickerChip: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#355274',
    backgroundColor: '#16253d',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  dayPickerChipActive: {
    borderColor: '#4aa987',
    backgroundColor: '#153c30',
  },
  dayPickerChipText: {
    color: '#dce9ff',
    fontWeight: '900',
    fontSize: 13,
  },
  dayPickerChipTextActive: {
    color: '#b6f2d7',
  },
  dayPickerChipName: {
    color: '#9fb8d8',
    fontWeight: '600',
    fontSize: 11,
  },
});
