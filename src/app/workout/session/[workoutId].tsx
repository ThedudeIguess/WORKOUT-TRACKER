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
          <Text style={styles.summaryLabel}>DURATION</Text>
          <Text style={styles.summaryValue}>{formatDuration(detail.durationMinutes)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>SETS</Text>
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
    backgroundColor: theme.colors.bg1,
    paddingHorizontal: 24,
  },
  container: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bg1,
  },
  heroCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.lg,
    gap: 3,
  },
  heroTag: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.xl,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
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
    gap: 4,
  },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  summaryValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.md,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  metaCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: 4,
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  notesText: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.sm,
    lineHeight: 18,
  },
  exerciseCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  exerciseTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.md,
    fontWeight: '800',
  },
  exerciseSetList: {
    gap: 6,
  },
  setRow: {
    minHeight: 40,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  setLeft: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  setCenter: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
    flex: 1,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  setRight: {
    color: theme.colors.info,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
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
