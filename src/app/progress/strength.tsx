import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ProgressChart } from '../../components/ProgressChart';
import { theme } from '../../constants/theme';
import { getBodyweightLog, getStrengthTrendSeries, listExercises } from '../../db/queries';
import type { StrengthTrendPoint } from '../../types';
import { estimateOneRepMax } from '../../utils/oneRepMax';

export default function StrengthTrendsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exerciseOptions, setExerciseOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [series, setSeries] = useState<StrengthTrendPoint[]>([]);
  const [latestBodyweight, setLatestBodyweight] = useState<number | null>(null);

  const loadSeries = useCallback(async (exerciseId: string) => {
    const points = await getStrengthTrendSeries(exerciseId);
    setSeries(points);
  }, []);

  const load = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) {
      setLoading(true);
    }

    try {
      const [exercises, bodyweightEntries] = await Promise.all([
        listExercises(),
        getBodyweightLog(1),
      ]);
      setExerciseOptions(exercises);
      setLatestBodyweight(bodyweightEntries[0]?.weightKg ?? null);

      const defaultExerciseId = selectedExerciseId ?? exercises[0]?.id ?? null;
      setSelectedExerciseId(defaultExerciseId);

      if (defaultExerciseId) {
        await loadSeries(defaultExerciseId);
      } else {
        setSeries([]);
      }
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  }, [loadSeries, selectedExerciseId]);

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

  const chartPoints = useMemo(
    () =>
      series.map((point) => ({
        label: new Date(point.completedAt).toLocaleDateString(),
        value: estimateOneRepMax(point.bestSetLoadKg, point.bestSetReps),
      })),
    [series]
  );

  const selectedExerciseName = useMemo(
    () =>
      exerciseOptions.find((exercise) => exercise.id === selectedExerciseId)?.name ??
      'Exercise',
    [exerciseOptions, selectedExerciseId]
  );

  const latestEstimate = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1].value : null;
  const firstEstimate = chartPoints.length > 0 ? chartPoints[0].value : null;
  const estimateDelta =
    latestEstimate !== null && firstEstimate !== null
      ? latestEstimate - firstEstimate
      : null;

  const targetLines = useMemo(() => {
    if (!latestBodyweight || latestBodyweight <= 0) {
      return [] as Array<{ label: string; value: number; color: string }>;
    }

    const lowercaseName = selectedExerciseName.toLowerCase();
    const lines: Array<{ label: string; value: number; color: string }> = [];

    if (lowercaseName.includes('bench')) {
      lines.push({
        label: `1.0x BW (${latestBodyweight.toFixed(1)} kg)`,
        value: latestBodyweight,
        color: theme.colors.info,
      });
    }

    if (lowercaseName.includes('squat')) {
      lines.push({
        label: `1.25x BW (${(latestBodyweight * 1.25).toFixed(1)} kg)`,
        value: latestBodyweight * 1.25,
        color: theme.colors.warning,
      });
    }

    return lines;
  }, [latestBodyweight, selectedExerciseName]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
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
        <Text style={styles.heroTag}>Strength Trends</Text>
        <Text style={styles.heroTitle}>{selectedExerciseName}</Text>
        <Text style={styles.heroSubtitle}>Estimated 1RM by session top set.</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pickerRow}
      >
        {exerciseOptions.map((exercise) => {
          const selected = exercise.id === selectedExerciseId;
          return (
            <Pressable
              key={exercise.id}
              onPress={() => {
                setSelectedExerciseId(exercise.id);
                void loadSeries(exercise.id);
              }}
              style={({ pressed }) => [
                styles.pickerChip,
                selected && styles.pickerChipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.pickerChipText, selected && styles.pickerChipTextSelected]}>
                {exercise.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.metricsRow}>
        <View style={styles.metricCardWide}>
          <Text style={styles.metricLabel}>CURRENT ESTIMATED 1RM</Text>
          <Text style={styles.metricValueHero}>
            {latestEstimate !== null ? `${latestEstimate.toFixed(1)} kg` : '-'}
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Delta</Text>
          <Text
            style={[
              styles.metricValue,
              estimateDelta === null
                ? null
                : estimateDelta >= 0
                  ? styles.metricPositive
                  : styles.metricNegative,
            ]}
          >
            {estimateDelta !== null ? `${estimateDelta >= 0 ? '+' : ''}${estimateDelta.toFixed(1)} kg` : '-'}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Sessions</Text>
          <Text style={styles.metricValue}>{series.length}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Bodyweight</Text>
          <Text style={styles.metricValue}>
            {latestBodyweight ? `${latestBodyweight.toFixed(1)} kg` : '-'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estimated 1RM Curve</Text>
        <ProgressChart
          points={chartPoints}
          color={theme.colors.accent}
          targetLines={targetLines}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Sessions</Text>
        {series.length === 0 ? (
          <Text style={styles.emptyText}>Log sets to see strength trends.</Text>
        ) : (
          [...series]
            .slice(-6)
            .reverse()
            .map((point) => (
              <View key={point.workoutId} style={styles.pointRow}>
                <Text style={styles.pointDate}>
                  {new Date(point.completedAt).toLocaleDateString()}
                </Text>
                <Text style={styles.pointText}>
                  {point.bestSetLoadKg} kg x {point.bestSetReps}
                </Text>
                <Text style={styles.pointEstimate}>
                  {estimateOneRepMax(point.bestSetLoadKg, point.bestSetReps).toFixed(1)} kg
                </Text>
              </View>
            ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg1,
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
    fontWeight: '800',
  },
  heroSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingVertical: 2,
  },
  pickerChip: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pickerChipSelected: {
    backgroundColor: theme.colors.accentDim,
    borderColor: theme.colors.accent,
  },
  pickerChipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  pickerChipTextSelected: {
    color: theme.colors.accent,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  metricCardWide: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  metricCard: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 6,
  },
  metricLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  metricValueHero: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.hero,
    lineHeight: 40,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  metricValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.lg,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  metricPositive: {
    color: theme.colors.accent,
  },
  metricNegative: {
    color: theme.colors.zoneOrange,
  },
  card: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.lg,
    fontWeight: '800',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  pointRow: {
    minHeight: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pointDate: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  pointText: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  pointEstimate: {
    color: theme.colors.accent,
    fontWeight: '900',
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.7,
  },
});
