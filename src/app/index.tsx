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
  getFirstWorkoutAnchor,
  getNextDayTemplate,
  getWeekStats,
  listProgramDayTemplates,
} from '../db/queries';
import type { ActiveWorkoutSummary, DayTemplateWithSlots } from '../types';
import { getRollingWeekWindow } from '../utils/rollingWeek';

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

function shortExerciseName(name: string): string {
  return name
    .replace('Barbell ', '')
    .replace('Dumbbell ', '')
    .replace('Machine ', '')
    .replace('(Glute Focus)', '');
}

export default function HomeScreen() {
  const router = useRouter();
  const pulse = useRef(new Animated.Value(1)).current;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutSummary | null>(null);
  const [nextDayTemplate, setNextDayTemplate] = useState<DayTemplateWithSlots | null>(null);
  const [dayTemplates, setDayTemplates] = useState<DayTemplateWithSlots[]>([]);
  const [firstWorkoutAnchor, setFirstWorkoutAnchor] = useState<string | null>(null);
  const [weekLabel, setWeekLabel] = useState('Week 0');
  const [weekRangeLabel, setWeekRangeLabel] = useState('');
  const [weekStats, setWeekStats] = useState({ workoutsThisWeek: 0, setsThisWeek: 0 });
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
      const maxDate = new Date();
      maxDate.setHours(23, 59, 59, 999);

      const minDate = firstWorkoutAnchor ? new Date(firstWorkoutAnchor) : null;

      if (value.getTime() > maxDate.getTime()) {
        return maxDate;
      }

      if (minDate && value.getTime() < minDate.getTime()) {
        return minDate;
      }

      return value;
    },
    [firstWorkoutAnchor]
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
      setFirstWorkoutAnchor(anchor);

      const nowIso = new Date().toISOString();
      const weekWindow = getRollingWeekWindow(nowIso, anchor ?? nowIso);
      const start = new Date(weekWindow.startIso).toLocaleDateString();
      const end = new Date(weekWindow.endIso).toLocaleDateString();

      setWeekLabel(`Week ${weekWindow.weekNumber + 1}`);
      setWeekRangeLabel(`${start} - ${end}`);

      const stats = await getWeekStats(weekWindow.startIso, weekWindow.endIso);
      setWeekStats(stats);

      if (anchor) {
        const anchorDate = new Date(anchor);
        setBackdateDate((current) =>
          current.getTime() < anchorDate.getTime() ? anchorDate : current
        );
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
              maximumDate={new Date()}
              minimumDate={firstWorkoutAnchor ? new Date(firstWorkoutAnchor) : undefined}
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
