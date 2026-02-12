import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import { getRollingWeekWindow } from '../utils/rollingWeek';
import type { ActiveWorkoutSummary, DayTemplateWithSlots } from '../types';

interface QuickLinkItem {
  id: string;
  title: string;
  subtitle: string;
  route: '/progress/volume' | '/workout/history' | '/progress/strength' | '/settings';
}

const quickLinks: QuickLinkItem[] = [
  {
    id: 'volume',
    title: 'Volume Dashboard',
    subtitle: 'Effective sets by muscle',
    route: '/progress/volume',
  },
  {
    id: 'history',
    title: 'Workout History',
    subtitle: 'Completed sessions',
    route: '/workout/history',
  },
  {
    id: 'strength',
    title: 'Strength Trends',
    subtitle: 'Estimated 1RM over time',
    route: '/progress/strength',
  },
  {
    id: 'settings',
    title: 'Settings',
    subtitle: 'Export and preferences',
    route: '/settings',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutSummary | null>(null);
  const [nextDayTemplate, setNextDayTemplate] = useState<DayTemplateWithSlots | null>(null);
  const [allDayTemplates, setAllDayTemplates] = useState<DayTemplateWithSlots[]>([]);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [weekLabel, setWeekLabel] = useState('Week 0');
  const [weekRangeLabel, setWeekRangeLabel] = useState('');
  const [weekStats, setWeekStats] = useState({ workoutsThisWeek: 0, setsThisWeek: 0 });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [active, nextTemplate, anchor, allTemplates] = await Promise.all([
        getActiveWorkout(),
        getNextDayTemplate(),
        getFirstWorkoutAnchor(),
        listProgramDayTemplates(),
      ]);

      setActiveWorkout(active);
      setNextDayTemplate(nextTemplate);
      setAllDayTemplates(allTemplates);

      const nowIso = new Date().toISOString();
      const weekWindow = getRollingWeekWindow(nowIso, anchor ?? nowIso);

      setWeekLabel(`Week ${weekWindow.weekNumber + 1}`);
      const start = new Date(weekWindow.startIso).toLocaleDateString();
      const end = new Date(weekWindow.endIso).toLocaleDateString();
      setWeekRangeLabel(`${start} - ${end}`);

      const stats = await getWeekStats(weekWindow.startIso, weekWindow.endIso);
      setWeekStats(stats);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const startButtonLabel = useMemo(
    () => (activeWorkout ? 'Resume Workout' : 'Start Workout'),
    [activeWorkout]
  );

  const nextWorkoutLabel = activeWorkout
    ? `Day ${activeWorkout.dayNumber} - ${activeWorkout.dayName}`
    : `Day ${nextDayTemplate?.dayNumber ?? 1} - ${nextDayTemplate?.dayName ?? 'Lower A'}`;

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

    if (!nextDayTemplate) {
      return;
    }

    router.push({
      pathname: '/workout/[dayId]',
      params: {
        dayId: String(nextDayTemplate.dayNumber),
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTag}>Hybrid Bodybuilding</Text>
        <Text style={styles.heroWeek}>{weekLabel}</Text>
        <Text style={styles.heroRange}>{weekRangeLabel}</Text>
      </View>

      <View style={styles.nextCard}>
        <View style={styles.nextHeaderRow}>
          <Text style={styles.nextTitle}>Next Session</Text>
          <View
            style={[
              styles.statusChip,
              activeWorkout ? styles.statusChipActive : styles.statusChipIdle,
            ]}
          >
            <Text
              style={[
                styles.statusChipText,
                activeWorkout ? styles.statusChipTextActive : styles.statusChipTextIdle,
              ]}
            >
              {activeWorkout ? 'IN PROGRESS' : 'READY'}
            </Text>
          </View>
        </View>
        <Text style={styles.nextWorkoutLabel}>{nextWorkoutLabel}</Text>
      </View>

      <Pressable onPress={handleStartPress} style={styles.startButton}>
        <Text style={styles.startButtonText}>{startButtonLabel}</Text>
      </Pressable>

      {!activeWorkout && allDayTemplates.length > 1 ? (
        <View style={styles.dayPickerCard}>
          <Pressable
            onPress={() => setShowDayPicker(!showDayPicker)}
            style={styles.dayPickerToggle}
          >
            <Text style={styles.dayPickerToggleText}>
              {showDayPicker ? 'Hide Day Picker' : 'Pick a Different Day'}
            </Text>
          </Pressable>
          {showDayPicker ? (
            <View style={styles.dayPickerGrid}>
              {allDayTemplates.map((template) => {
                const isNext = template.dayNumber === nextDayTemplate?.dayNumber;
                return (
                  <Pressable
                    key={template.id}
                    onPress={() => {
                      router.push({
                        pathname: '/workout/[dayId]',
                        params: { dayId: String(template.dayNumber) },
                      });
                    }}
                    style={[styles.dayPickerChip, isNext && styles.dayPickerChipActive]}
                  >
                    <Text style={[styles.dayPickerChipText, isNext && styles.dayPickerChipTextActive]}>
                      Day {template.dayNumber}
                    </Text>
                    <Text style={styles.dayPickerChipName}>{template.dayName}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Workouts This Week</Text>
          <Text style={styles.statValue}>{weekStats.workoutsThisWeek}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Sets This Week</Text>
          <Text style={styles.statValue}>{weekStats.setsThisWeek}</Text>
        </View>
      </View>

      <View style={styles.quickLinksCard}>
        <Text style={styles.quickLinksTitle}>Explore</Text>
        <View style={styles.quickLinksGrid}>
          {quickLinks.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(item.route)}
              style={styles.quickLinkButton}
            >
              <Text style={styles.quickLinkTitle}>{item.title}</Text>
              <Text style={styles.quickLinkSubtitle}>{item.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    padding: 16,
    gap: 12,
    backgroundColor: theme.colors.background,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#35547a',
    backgroundColor: '#13243c',
    padding: 14,
    gap: 2,
  },
  heroTag: {
    color: '#aac6e8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroWeek: {
    color: '#eff6ff',
    fontSize: 28,
    fontWeight: '900',
  },
  heroRange: {
    color: '#b4c9e5',
    fontSize: 13,
    fontWeight: '700',
  },
  nextCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#304768',
    backgroundColor: '#0f1929',
    padding: 12,
    gap: 6,
  },
  nextHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextTitle: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  statusChip: {
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  statusChipActive: {
    borderColor: '#4ea0df',
    backgroundColor: '#173659',
  },
  statusChipIdle: {
    borderColor: '#2f6b56',
    backgroundColor: '#16362b',
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  statusChipTextActive: {
    color: '#cae8ff',
  },
  statusChipTextIdle: {
    color: '#b4efcf',
  },
  nextWorkoutLabel: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  startButton: {
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#071910',
    fontSize: 20,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2f4668',
    backgroundColor: '#0f1a2b',
    padding: 12,
    gap: 8,
  },
  statLabel: {
    color: '#9ab6d9',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#eef5ff',
    fontSize: 26,
    fontWeight: '900',
  },
  quickLinksCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#304767',
    backgroundColor: '#0f192a',
    padding: 12,
    gap: 10,
  },
  quickLinksTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  quickLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickLinkButton: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 68,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#395479',
    backgroundColor: '#14233a',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  quickLinkTitle: {
    color: '#e5efff',
    fontWeight: '800',
    fontSize: 13,
  },
  quickLinkSubtitle: {
    color: '#a4bfdc',
    fontWeight: '600',
    fontSize: 11,
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
