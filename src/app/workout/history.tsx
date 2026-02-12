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
import { getWorkoutHistory, getWorkoutExerciseSummaries } from '../../db/queries';
import type { WorkoutHistoryItem } from '../../types';
import { theme } from '../../constants/theme';

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${String(remainingMinutes).padStart(2, '0')}m`;
}

export default function WorkoutHistoryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WorkoutHistoryItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const load = async () => {
        setLoading(true);
        try {
          const history = await getWorkoutHistory(100);
          if (!mounted) return;

          const workoutIds = history.map((h) => h.workoutId);
          const summaries = await getWorkoutExerciseSummaries(workoutIds);
          const enriched = history.map((item) => ({
            ...item,
            exerciseSummary: summaries[item.workoutId]?.join(', ') ?? '',
          }));

          if (mounted) {
            setItems(enriched);
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
    }, [])
  );

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
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <View style={styles.heroCard}>
            <Text style={styles.heroTag}>Completed Workouts</Text>
            <Text style={styles.heroTitle}>{summary.totalWorkouts}</Text>
            <Text style={styles.heroSubtitle}>Sessions tracked</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Sets</Text>
              <Text style={styles.summaryValue}>{summary.totalSets}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Avg Duration</Text>
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
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/workout/session/[workoutId]',
              params: { workoutId: item.workoutId },
            })
          }
          style={styles.card}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.dayChip}>
              <Text style={styles.dayChipText}>Day {item.dayNumber}</Text>
            </View>
            <Text style={styles.dateText}>
              {new Date(item.completedAt).toLocaleDateString()} {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <Text style={styles.title}>{item.dayName}</Text>

          {item.exerciseSummary ? (
            <Text style={styles.exerciseSummaryText} numberOfLines={2}>
              {item.exerciseSummary}
            </Text>
          ) : null}

          <View style={styles.metricsRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Duration</Text>
              <Text style={styles.metricValue}>{formatDuration(item.durationMinutes)}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Sets</Text>
              <Text style={styles.metricValue}>{item.totalSets}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>PRS</Text>
              <Text style={styles.metricValue}>{item.prsScore ?? '-'}</Text>
            </View>
          </View>
        </Pressable>
      )}
      ListFooterComponent={<View style={styles.footerSpace} />}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  listContent: {
    padding: 12,
    gap: 10,
    backgroundColor: theme.colors.background,
  },
  headerBlock: {
    gap: 10,
  },
  heroCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#345378',
    backgroundColor: '#122238',
    padding: 12,
    gap: 2,
  },
  heroTag: {
    color: '#a7c6ec',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroTitle: {
    color: '#ebf3ff',
    fontSize: 30,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: '#b2c7e3',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2f4868',
    backgroundColor: '#101b2d',
    padding: 10,
    gap: 6,
  },
  summaryLabel: {
    color: '#9fb8d8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: '#eef5ff',
    fontSize: 21,
    fontWeight: '900',
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 14,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#304868',
    backgroundColor: '#0f1a2b',
    padding: 12,
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayChip: {
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#466a99',
    backgroundColor: '#193152',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  dayChipText: {
    color: '#d3e7ff',
    fontSize: 11,
    fontWeight: '900',
  },
  dateText: {
    color: '#9fb8d8',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  exerciseSummaryText: {
    color: '#9fb8d8',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricPill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#324b6e',
    backgroundColor: '#122036',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 2,
  },
  metricLabel: {
    color: '#9fb8d8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#ebf4ff',
    fontSize: 14,
    fontWeight: '800',
  },
  footerSpace: {
    height: 16,
  },
});
