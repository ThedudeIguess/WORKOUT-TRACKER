import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MuscleMapSvg } from '../../components/MuscleMapSvg';
import { muscleGroups } from '../../constants/mevThresholds';
import { theme } from '../../constants/theme';
import { getFirstWorkoutAnchor } from '../../db/queries';
import type { MuscleVolumeResult, VolumeZone } from '../../types';
import { getRollingWeekWindow } from '../../utils/rollingWeek';
import { calculateVolumeForDateRange } from '../../utils/volumeCalculator';

const zoneColors: Record<VolumeZone, string> = {
  RED: theme.colors.zoneRed,
  YELLOW: theme.colors.zoneYellow,
  GREEN: theme.colors.zoneGreen,
  AMBER: theme.colors.zoneAmber,
  ORANGE: theme.colors.zoneOrange,
};

const zoneLegend = [
  { label: 'Under MEV', color: theme.colors.zoneRed },
  { label: 'MEV to Optimal', color: theme.colors.zoneYellow },
  { label: 'Optimal', color: theme.colors.zoneGreen },
  { label: 'High', color: theme.colors.zoneAmber },
  { label: 'Above MRV', color: theme.colors.zoneOrange },
  { label: 'No Data', color: '#2a3548' },
];

export default function BodyMapScreen() {
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weekLabel, setWeekLabel] = useState('Week 1');
  const [rangeLabel, setRangeLabel] = useState('');
  const [results, setResults] = useState<MuscleVolumeResult[]>([]);
  const [selectedMuscleId, setSelectedMuscleId] = useState<string>('quads');

  const load = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) {
      setLoading(true);
    }

    try {
      const anchor = await getFirstWorkoutAnchor();
      const nowIso = new Date().toISOString();
      const weekWindow = getRollingWeekWindow(nowIso, anchor ?? nowIso);
      const start = new Date(weekWindow.startIso);
      const end = new Date(weekWindow.endIso);

      const data = await calculateVolumeForDateRange(
        weekWindow.startIso,
        weekWindow.endIso
      );

      setWeekLabel(`Week ${weekWindow.weekNumber + 1}`);
      setRangeLabel(`${start.toLocaleDateString()} - ${end.toLocaleDateString()}`);
      setResults(data);

      if (!data.some((result) => result.muscleGroupId === selectedMuscleId)) {
        setSelectedMuscleId(data[0]?.muscleGroupId ?? 'quads');
      }
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  }, [selectedMuscleId]);

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

  const resultsByMuscle = useMemo(() => {
    const map: Record<string, MuscleVolumeResult> = {};
    for (const result of results) {
      map[result.muscleGroupId] = result;
    }
    return map;
  }, [results]);

  const selectedResult = useMemo(() => {
    return results.find((result) => result.muscleGroupId === selectedMuscleId) ?? null;
  }, [results, selectedMuscleId]);

  const selectedMuscleDisplay =
    selectedResult?.displayName ??
    muscleGroups.find((muscle) => muscle.id === selectedMuscleId)?.displayName ??
    'Muscle';

  const mapsAreStacked = width < 760;
  const selectedZoneLabel =
    selectedResult && selectedResult.effectiveSets > 0
      ? selectedResult.zone
      : 'NO DATA';

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
        <Text style={styles.heroTag}>Muscle Map</Text>
        <Text style={styles.heroWeek}>{weekLabel}</Text>
        <Text style={styles.heroRange}>{rangeLabel}</Text>
      </View>

      <View style={[styles.mapsRow, mapsAreStacked && styles.mapsColumn]}>
        <View style={styles.mapCard}>
          <Text style={styles.mapLabel}>Front</Text>
          <MuscleMapSvg
            view="front"
            resultsByMuscle={resultsByMuscle}
            selectedMuscleId={selectedMuscleId}
            onSelectMuscle={setSelectedMuscleId}
          />
        </View>

        <View style={styles.mapCard}>
          <Text style={styles.mapLabel}>Back</Text>
          <MuscleMapSvg
            view="back"
            resultsByMuscle={resultsByMuscle}
            selectedMuscleId={selectedMuscleId}
            onSelectMuscle={setSelectedMuscleId}
          />
        </View>
      </View>

      <View style={styles.legendCard}>
        <Text style={styles.legendTitle}>Zone Legend</Text>
        <View style={styles.legendGrid}>
          {zoneLegend.map((entry) => (
            <View key={entry.label} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: entry.color }]} />
              <Text style={styles.legendText}>{entry.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>{selectedMuscleDisplay}</Text>
        <Text
          style={[
            styles.detailZone,
            selectedResult && selectedResult.effectiveSets > 0
              ? { color: zoneColors[selectedResult.zone] }
              : { color: theme.colors.textMuted },
          ]}
        >
          {selectedZoneLabel}
        </Text>
        <Text style={styles.detailText}>
          Effective sets this week: {selectedResult?.effectiveSets.toFixed(1) ?? '0.0'}
        </Text>
        <Text style={styles.detailText}>
          MEV: {selectedResult?.thresholds.mevLow ?? '-'} - {selectedResult?.thresholds.mevHigh ?? '-'}
        </Text>
        <Text style={styles.detailText}>
          Optimal: {selectedResult?.thresholds.optimalLow ?? '-'} - {selectedResult?.thresholds.optimalHigh ?? '-'}
        </Text>
        <Text style={styles.detailText}>
          MRV: {selectedResult?.thresholds.mrvLow ?? '-'} - {selectedResult?.thresholds.mrvHigh ?? '-'}
        </Text>
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
  heroWeek: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.xl,
    fontWeight: '900',
  },
  heroRange: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  mapsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  mapsColumn: {
    flexDirection: 'column',
  },
  mapCard: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  mapLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  legendCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  legendTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.md,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  legendItem: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  detailCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: 6,
  },
  detailTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.xl,
    fontWeight: '900',
  },
  detailZone: {
    fontSize: theme.fontSize.sm,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  detailText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
