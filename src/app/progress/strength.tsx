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
import {
  getBodyweightLog,
  getStrengthTrendSeries,
  listExerciseLibrary,
} from '../../db/queries';
import type { ProgressionRateResult, StrengthTrendPoint } from '../../types';
import { estimateOneRepMax } from '../../utils/oneRepMax';
import { calculateProgressionRate } from '../../utils/progressionRate';

interface ProgressionOverviewRow {
  exerciseId: string;
  exerciseName: string;
  rate: ProgressionRateResult;
}

function getTrendArrow(
  rateKgPerWeek: number
): { symbol: string; color: string } {
  if (rateKgPerWeek > 0) {
    return { symbol: '↑', color: theme.colors.accent };
  }

  if (rateKgPerWeek < 0) {
    return { symbol: '↓', color: theme.colors.warning };
  }

  return { symbol: '→', color: theme.colors.textSecondary };
}

export default function StrengthTrendsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exerciseOptions, setExerciseOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [series, setSeries] = useState<StrengthTrendPoint[]>([]);
  const [latestBodyweight, setLatestBodyweight] = useState<number | null>(null);
  const [progressionOverview, setProgressionOverview] = useState<
    ProgressionOverviewRow[]
  >([]);

  const loadSeries = useCallback(async (exerciseId: string) => {
    const points = await getStrengthTrendSeries(exerciseId);
    setSeries(points);
  }, []);

  const load = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) {
      setLoading(true);
    }

    try {
      const [exerciseLibrary, bodyweightEntries] = await Promise.all([
        listExerciseLibrary(),
        getBodyweightLog(1),
      ]);
      const activeExercises = exerciseLibrary
        .filter((exercise) => exercise.isActive)
        .sort((left, right) => left.name.localeCompare(right.name));
      const options = activeExercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
      }));
      setExerciseOptions(options);
      setLatestBodyweight(bodyweightEntries[0]?.weightKg ?? null);

      const defaultExerciseId = activeExercises.some(
        (exercise) => exercise.id === selectedExerciseId
      )
        ? selectedExerciseId
        : activeExercises[0]?.id ?? null;
      setSelectedExerciseId(defaultExerciseId);

      const compoundExercises = activeExercises.filter(
        (exercise) => exercise.category === 'compound'
      );

      const [defaultSeries, compoundRateRows] = await Promise.all([
        defaultExerciseId ? getStrengthTrendSeries(defaultExerciseId) : Promise.resolve([]),
        Promise.all(
          compoundExercises.map(async (exercise) => {
            const points = await getStrengthTrendSeries(exercise.id);
            return {
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              rate: calculateProgressionRate(exercise.id, points),
            };
          })
        ),
      ]);

      setSeries(defaultSeries);
      setProgressionOverview(
        compoundRateRows
          .filter((row) => row.rate.hasEnoughData)
          .sort((left, right) => {
            const leftHasReference = left.rate.referenceRateKgPerWeek !== null ? 0 : 1;
            const rightHasReference = right.rate.referenceRateKgPerWeek !== null ? 0 : 1;
            if (leftHasReference !== rightHasReference) {
              return leftHasReference - rightHasReference;
            }

            const rateDelta =
              right.rate.actualRateKgPerWeek - left.rate.actualRateKgPerWeek;
            if (rateDelta !== 0) {
              return rateDelta;
            }

            return left.exerciseName.localeCompare(right.exerciseName);
          })
      );
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  }, [selectedExerciseId]);

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

  const selectedProgressionRate = useMemo(
    () =>
      selectedExerciseId
        ? calculateProgressionRate(selectedExerciseId, series)
        : null,
    [selectedExerciseId, series]
  );

  const selectedRateArrow = useMemo(
    () =>
      selectedProgressionRate
        ? getTrendArrow(selectedProgressionRate.actualRateKgPerWeek)
        : null,
    [selectedProgressionRate]
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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progression Overview</Text>
        {progressionOverview.length === 0 ? (
          <Text style={styles.emptyText}>
            Not enough data yet - need 4+ sessions over 2+ weeks for compound lifts.
          </Text>
        ) : (
          progressionOverview.map((row) => {
            const trendArrow = getTrendArrow(row.rate.actualRateKgPerWeek);
            return (
              <View key={row.exerciseId} style={styles.overviewRow}>
                <View style={styles.overviewLeft}>
                  <Text style={styles.overviewExerciseName}>{row.exerciseName}</Text>
                </View>
                <View style={styles.overviewCenter}>
                  <Text style={styles.overviewRate}>
                    {`${row.rate.actualRateKgPerWeek >= 0 ? '+' : ''}${row.rate.actualRateKgPerWeek.toFixed(1)} kg/week`}
                  </Text>
                  {row.rate.referenceRateKgPerWeek !== null ? (
                    <Text style={styles.overviewReference}>
                      Ref {row.rate.referenceRateKgPerWeek.toFixed(1)} kg/week
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.overviewArrow, { color: trendArrow.color }]}>
                  {trendArrow.symbol}
                </Text>
              </View>
            );
          })
        )}
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
        <Text style={styles.cardTitle}>Progression Rate</Text>
        {!selectedProgressionRate?.hasEnoughData ? (
          <Text style={styles.emptyText}>
            Not enough data yet - need 4+ sessions over 2+ weeks.
          </Text>
        ) : (
          <View style={styles.rateCardContent}>
            <View style={styles.rateHeadlineRow}>
              <Text style={styles.rateHeadlineLabel}>Your rate:</Text>
              <Text style={styles.rateHeadlineValue}>
                {`${selectedProgressionRate.actualRateKgPerWeek >= 0 ? '+' : ''}${selectedProgressionRate.actualRateKgPerWeek.toFixed(1)} kg/week`}
              </Text>
              {selectedRateArrow ? (
                <Text style={[styles.rateArrow, { color: selectedRateArrow.color }]}>
                  {selectedRateArrow.symbol}
                </Text>
              ) : null}
            </View>
            <Text style={styles.rateSubtext}>
              Over {selectedProgressionRate.weeksOfData.toFixed(1)} weeks (
              {selectedProgressionRate.sessionCount} sessions)
            </Text>

            {selectedExerciseId === 'barbell-bench-press' &&
            selectedProgressionRate.referenceRateKgPerWeek !== null ? (
              <>
                <Text style={styles.rateReferenceText}>
                  Reference: ~{selectedProgressionRate.referenceRateKgPerWeek.toFixed(1)}
                  {' '}kg/week at this stage
                </Text>
                {selectedProgressionRate.referenceCaveat ? (
                  <Text style={styles.rateCaveat}>
                    {selectedProgressionRate.referenceCaveat}
                  </Text>
                ) : null}
              </>
            ) : null}

            {selectedExerciseId === 'barbell-back-squat' &&
            selectedProgressionRate.referenceRateKgPerWeek !== null ? (
              <>
                <Text style={styles.rateReferenceText}>
                  Reference: ~{selectedProgressionRate.referenceRateKgPerWeek.toFixed(2)}
                  {' '}kg/week (24-week average)
                </Text>
                {selectedProgressionRate.referenceCaveat ? (
                  <Text style={styles.rateCaveat}>
                    {selectedProgressionRate.referenceCaveat}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        )}
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
  overviewRow: {
    minHeight: 52,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overviewLeft: {
    flex: 1,
  },
  overviewCenter: {
    alignItems: 'flex-end',
    gap: 2,
  },
  overviewExerciseName: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  overviewRate: {
    color: theme.colors.accent,
    fontWeight: '900',
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  overviewReference: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  overviewArrow: {
    width: 20,
    textAlign: 'right',
    fontSize: theme.fontSize.lg,
    fontWeight: '900',
  },
  rateCardContent: {
    gap: theme.spacing.xs,
  },
  rateHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
  },
  rateHeadlineLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  rateHeadlineValue: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.xxl,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  rateArrow: {
    fontSize: theme.fontSize.xl,
    fontWeight: '900',
    marginLeft: 2,
  },
  rateSubtext: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  rateReferenceText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  rateCaveat: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    lineHeight: 16,
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
