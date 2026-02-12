import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../../constants/theme';
import { getWorkoutExerciseSummaries, getWorkoutHistory } from '../../db/queries';
import type { WorkoutHistoryItem } from '../../types';

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${String(remainingMinutes).padStart(2, '0')}m`;
}

function prsBadgeColor(prsScore: number | null): string {
  if (prsScore === null) {
    return theme.colors.textMuted;
  }
  if (prsScore <= 3) {
    return theme.colors.zoneRed;
  }
  if (prsScore <= 6) {
    return theme.colors.zoneYellow;
  }
  return theme.colors.zoneGreen;
}

export default function WorkoutHistoryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<WorkoutHistoryItem[]>([]);
  const [exerciseSummariesByWorkout, setExerciseSummariesByWorkout] = useState<
    Record<string, string>
  >({});

  const load = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) {
      setLoading(true);
    }

    try {
      const history = await getWorkoutHistory(100);
      setItems(history);

      const workoutIds = history.map((entry) => entry.workoutId);
      if (workoutIds.length === 0) {
        setExerciseSummariesByWorkout({});
      } else {
        const summaries = await getWorkoutExerciseSummaries(workoutIds);
        const next: Record<string, string> = {};
        for (const workoutId of workoutIds) {
          const labels = summaries[workoutId] ?? [];
          next[workoutId] = labels.join(', ');
        }
        setExerciseSummariesByWorkout(next);
      }
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(true);
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(false);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const summary = useMemo(() => {
    const totalSets = items.reduce((sum, item) => sum + item.totalSets, 0);
    const totalMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
    const averageMinutes = items.length > 0 ? Math.round(totalMinutes / items.length) : 0;

    return {
      totalWorkouts: items.length,
      totalSets,
      averageMinutes,
    };
  }, [items]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.workoutId}
      contentContainerStyle={styles.listContent}
      refreshing={refreshing}
      onRefresh={() => {
        void onRefresh();
      }}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <View style={styles.heroCard}>
            <Text style={styles.heroTag}>Workout History</Text>
            <Text style={styles.heroValue}>{summary.totalWorkouts}</Text>
            <Text style={styles.heroSubtitle}>Completed sessions</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>TOTAL SETS</Text>
              <Text style={styles.summaryValue}>{summary.totalSets}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>AVG DURATION</Text>
              <Text style={styles.summaryValue}>{formatDuration(summary.averageMinutes)}</Text>
            </View>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No completed workouts yet.</Text>
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item, index }) => {
        const completedAtDate = new Date(item.completedAt);
        const day = completedAtDate.getDate();
        const monthYear = completedAtDate.toLocaleDateString([], {
          month: 'short',
          year: 'numeric',
        });
        const color = prsBadgeColor(item.prsScore);
        const exerciseSummary = exerciseSummariesByWorkout[item.workoutId];

        return (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/workout/session/[workoutId]',
                params: { workoutId: item.workoutId },
              })
            }
            style={({ pressed }) => [
              styles.card,
              index % 2 === 1 && styles.cardAlt,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.cardTopRow}>
              <View style={styles.dateBlock}>
                <Text style={styles.dateDay}>{day}</Text>
                <Text style={styles.dateMonthYear}>{monthYear}</Text>
              </View>

              <View style={styles.cardMain}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.title}>
                    Day {item.dayNumber} • {item.dayName}
                  </Text>
                  <View style={[styles.prsBadge, { borderColor: color }]}> 
                    <Text style={[styles.prsBadgeText, { color }]}>PRS {item.prsScore ?? '-'}</Text>
                  </View>
                </View>

                {exerciseSummary ? (
                  <Text style={styles.exerciseSummaryText} numberOfLines={2}>
                    {exerciseSummary}
                  </Text>
                ) : null}

                <View style={styles.metricsRow}>
                  <Text style={styles.metricValue}>{formatDuration(item.durationMinutes)}</Text>
                  <Text style={styles.metricDivider}>•</Text>
                  <Text style={styles.metricValue}>{item.totalSets} sets</Text>
                  <Text style={styles.metricDivider}>•</Text>
                  <Text style={styles.metricValue}>
                    {completedAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        );
      }}
      ListFooterComponent={<View style={styles.footerSpace} />}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg1,
  },
  listContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bg1,
  },
  headerBlock: {
    gap: theme.spacing.md,
  },
  heroCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.lg,
    gap: 2,
  },
  heroTag: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.hero,
    lineHeight: 40,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  heroSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  summaryCard: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: 6,
  },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  summaryValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.xl,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  emptyCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.lg,
  },
  emptyText: {
    color: theme.colors.textSecondary,
  },
  card: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#111923',
    padding: theme.spacing.md,
  },
  cardAlt: {
    backgroundColor: '#0e1520',
  },
  cardTopRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  dateBlock: {
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    paddingVertical: 6,
  },
  dateDay: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.xxl,
    fontWeight: '900',
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  dateMonthYear: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  cardMain: {
    flex: 1,
    gap: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.md,
    fontWeight: '800',
  },
  prsBadge: {
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: theme.colors.bg1,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  prsBadgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  exerciseSummaryText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    lineHeight: 17,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricValue: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metricDivider: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  footerSpace: {
    height: 14,
  },
  pressed: {
    opacity: 0.7,
  },
});
