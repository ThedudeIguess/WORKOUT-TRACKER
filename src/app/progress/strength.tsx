import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ProgressChart } from '../../components/ProgressChart';
import { theme } from '../../constants/theme';
import { getStrengthTrendSeries, listExercises } from '../../db/queries';
import type { StrengthTrendPoint } from '../../types';
import { estimateOneRepMax } from '../../utils/oneRepMax';

export default function StrengthTrendsScreen() {
  const [loading, setLoading] = useState(true);
  const [exerciseOptions, setExerciseOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [series, setSeries] = useState<StrengthTrendPoint[]>([]);

  const loadSeries = useCallback(async (exerciseId: string) => {
    const points = await getStrengthTrendSeries(exerciseId);
    setSeries(points);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const load = async () => {
        setLoading(true);
        try {
          const exercises = await listExercises();
          if (!mounted) {
            return;
          }

          setExerciseOptions(exercises);

          const defaultExerciseId = selectedExerciseId ?? exercises[0]?.id ?? null;
          setSelectedExerciseId(defaultExerciseId);

          if (defaultExerciseId) {
            await loadSeries(defaultExerciseId);
          } else {
            setSeries([]);
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
    }, [loadSeries, selectedExerciseId])
  );

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTag}>Strength Trends</Text>
        <Text style={styles.heroTitle}>{selectedExerciseName}</Text>
        <Text style={styles.heroSubtitle}>Estimated 1RM from top logged set per session.</Text>
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
              style={[styles.pickerChip, selected && styles.pickerChipSelected]}
            >
              <Text style={[styles.pickerChipText, selected && styles.pickerChipTextSelected]}>
                {exercise.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Latest e1RM</Text>
          <Text style={styles.metricValue}>
            {latestEstimate !== null ? `${latestEstimate.toFixed(1)} kg` : '-'}
          </Text>
        </View>
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
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estimated 1RM Curve</Text>
        <ProgressChart points={chartPoints} />
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
    backgroundColor: theme.colors.background,
  },
  container: {
    padding: 12,
    gap: 10,
    backgroundColor: theme.colors.background,
  },
  heroCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#36557a',
    backgroundColor: '#13253e',
    padding: 12,
    gap: 3,
  },
  heroTag: {
    color: '#afc8e9',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroTitle: {
    color: '#eff5ff',
    fontSize: 22,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: '#b6c9e3',
    fontSize: 12,
    fontWeight: '600',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  pickerChip: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#364d6d',
    backgroundColor: '#101b2d',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pickerChipSelected: {
    backgroundColor: '#204565',
    borderColor: '#4092db',
  },
  pickerChipText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  pickerChipTextSelected: {
    color: '#d9f0ff',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2f486a',
    backgroundColor: '#111d31',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 6,
  },
  metricLabel: {
    color: '#9eb9db',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#f0f6ff',
    fontSize: 18,
    fontWeight: '900',
  },
  metricPositive: {
    color: '#6de0b3',
  },
  metricNegative: {
    color: '#f4b482',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#304868',
    backgroundColor: '#0f192a',
    padding: 12,
    gap: 8,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  pointRow: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2d4261',
    backgroundColor: '#121f34',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pointDate: {
    color: '#bad0ea',
    fontWeight: '700',
    fontSize: 12,
  },
  pointText: {
    color: '#d8e5f8',
    fontWeight: '700',
    fontSize: 12,
  },
  pointEstimate: {
    color: '#79c3ff',
    fontWeight: '900',
    fontSize: 12,
  },
});
