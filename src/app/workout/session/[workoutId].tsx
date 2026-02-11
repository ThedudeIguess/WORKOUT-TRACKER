import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../../../constants/theme';
import { getWorkoutDetail } from '../../../db/queries';
import type { WorkoutDetail, WorkoutDetailSet } from '../../../types';

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${String(remainingMinutes).padStart(2, '0')}m`;
}

interface GroupedExerciseSets {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutDetailSet[];
}

export default function WorkoutSessionDetailScreen() {
  const params = useLocalSearchParams<{ workoutId: string }>();
  const workoutId = params.workoutId ?? '';
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const load = async () => {
        setLoading(true);
        setError(null);
        try {
          const nextDetail = await getWorkoutDetail(workoutId);
          if (!mounted) {
            return;
          }

          setDetail(nextDetail);
        } catch (loadError) {
          if (mounted) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : 'Could not load workout details.'
            );
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

      if (!workoutId) {
        setError('Missing workout id.');
        setLoading(false);
        return () => {
          mounted = false;
        };
      }

      void load();

      return () => {
        mounted = false;
      };
    }, [workoutId])
  );

  const groupedSets = useMemo<GroupedExerciseSets[]>(() => {
    if (!detail) {
      return [];
    }

    const order: string[] = [];
    const byExercise = new Map<string, GroupedExerciseSets>();

    for (const set of detail.sets) {
      if (!byExercise.has(set.exerciseId)) {
        byExercise.set(set.exerciseId, {
          exerciseId: set.exerciseId,
          exerciseName: set.exerciseName,
          sets: [],
        });
        order.push(set.exerciseId);
      }

      byExercise.get(set.exerciseId)?.sets.push(set);
    }

    return order
      .map((exerciseId) => byExercise.get(exerciseId))
      .filter((value): value is GroupedExerciseSets => value !== undefined);
  }, [detail]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Workout not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Workout Detail' }} />
      <View style={styles.heroCard}>
        <Text style={styles.heroTag}>Workout Detail</Text>
        <Text style={styles.heroTitle}>
          Day {detail.dayNumber} - {detail.dayName}
        </Text>
        <Text style={styles.heroSubtitle}>
          {new Date(detail.completedAt ?? detail.startedAt).toLocaleDateString()} {new Date(detail.completedAt ?? detail.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Duration</Text>
          <Text style={styles.summaryValue}>{formatDuration(detail.durationMinutes)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Sets</Text>
          <Text style={styles.summaryValue}>{detail.totalSets}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>PRS</Text>
          <Text style={styles.summaryValue}>{detail.prsScore ?? '-'}</Text>
        </View>
      </View>

      <View style={styles.metaCard}>
        <Text style={styles.metaText}>
          Bodyweight: {detail.bodyweightKg !== null ? `${detail.bodyweightKg.toFixed(1)} kg` : '-'}
        </Text>
        {detail.notes ? <Text style={styles.notesText}>Notes: {detail.notes}</Text> : null}
      </View>

      {groupedSets.map((group) => (
        <View key={group.exerciseId} style={styles.exerciseCard}>
          <Text style={styles.exerciseTitle}>{group.exerciseName}</Text>
          <View style={styles.exerciseSetList}>
            {group.sets.map((set) => (
              <View key={set.id} style={styles.setRow}>
                <Text style={styles.setLeft}>
                  Set {set.setOrder}{set.isWarmup ? ' (warmup)' : ''}
                </Text>
                <Text style={styles.setCenter}>
                  {set.loadKg} kg x {set.reps}
                </Text>
                <Text style={styles.setRight}>{set.effortLabel}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 24,
  },
  container: {
    padding: 12,
    gap: 10,
    backgroundColor: theme.colors.background,
  },
  heroCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#345378',
    backgroundColor: '#122238',
    padding: 12,
    gap: 3,
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
    fontSize: 22,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: '#b2c7e3',
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: '#eef5ff',
    fontSize: 16,
    fontWeight: '900',
  },
  metaCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2f4769',
    backgroundColor: '#101b2d',
    padding: 10,
    gap: 4,
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  notesText: {
    color: '#d3ddeb',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  exerciseCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#304868',
    backgroundColor: '#0f1a2b',
    padding: 12,
    gap: 8,
  },
  exerciseTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  exerciseSetList: {
    gap: 6,
  },
  setRow: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#314b6f',
    backgroundColor: '#122036',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  setLeft: {
    color: '#cde0f8',
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
  },
  setCenter: {
    color: '#eaf4ff',
    fontWeight: '800',
    fontSize: 12,
    flex: 1,
    textAlign: 'center',
  },
  setRight: {
    color: '#9dc3f2',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'capitalize',
    flex: 1,
    textAlign: 'right',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: '700',
    textAlign: 'center',
  },
});
