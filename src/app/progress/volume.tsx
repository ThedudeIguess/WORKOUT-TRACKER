import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MuscleBar } from '../../components/MuscleBar';
import { theme } from '../../constants/theme';
import { getFirstWorkoutAnchor } from '../../db/queries';
import type { MuscleVolumeResult, VolumeZone } from '../../types';
import { getRollingWeekWindow } from '../../utils/rollingWeek';
import { calculateVolumeForDateRange } from '../../utils/volumeCalculator';

const zoneOrder: VolumeZone[] = ['RED', 'YELLOW', 'GREEN', 'AMBER', 'ORANGE'];
const zoneColor: Record<VolumeZone, string> = {
  RED: theme.colors.zoneRed,
  YELLOW: theme.colors.zoneYellow,
  GREEN: theme.colors.zoneGreen,
  AMBER: theme.colors.zoneAmber,
  ORANGE: theme.colors.zoneOrange,
};

const zoneLabel: Record<VolumeZone, string> = {
  RED: 'Under MEV',
  YELLOW: 'MEV to Optimal',
  GREEN: 'Optimal',
  AMBER: 'High',
  ORANGE: 'Above MRV',
};

export default function VolumeDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rangeLabel, setRangeLabel] = useState('');
  const [weekLabel, setWeekLabel] = useState('Week 1');
  const [results, setResults] = useState<MuscleVolumeResult[]>([]);

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
      setRangeLabel(
        `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
      );
      setResults(data);
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

  const maxDisplayValue = Math.max(
    14,
    ...results.map((result) => result.thresholds.mrvHigh)
  );

  const sortedResults = useMemo(
    () =>
      [...results].sort((left, right) => {
        const zoneDelta = zoneOrder.indexOf(left.zone) - zoneOrder.indexOf(right.zone);
        if (zoneDelta !== 0) {
          return zoneDelta;
        }

        const valueDelta = right.effectiveSets - left.effectiveSets;
        if (valueDelta !== 0) {
          return valueDelta;
        }

        return left.displayName.localeCompare(right.displayName);
      }),
    [results]
  );

  const zoneCounts = useMemo(() => {
    const counts: Record<VolumeZone, number> = {
      RED: 0,
      YELLOW: 0,
      GREEN: 0,
      AMBER: 0,
      ORANGE: 0,
    };

    for (const result of results) {
      counts[result.zone] += 1;
    }

    return counts;
  }, [results]);

  const optimalCount = zoneCounts.GREEN;

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
        <Text style={styles.heroTag}>Weekly Volume Dashboard</Text>
        <Text style={styles.heroMetric}>
          {optimalCount} of {results.length}
        </Text>
        <Text style={styles.heroTitle}>muscles in optimal zone</Text>
        <Text style={styles.rangeLabel}>
          {weekLabel} • {rangeLabel}
        </Text>
      </View>

      <View style={styles.zoneSummaryRow}>
        {zoneOrder.map((zone) => (
          <View key={zone} style={[styles.zoneSummaryChip, { borderColor: zoneColor[zone] }]}>
            <Text style={[styles.zoneSummaryCount, { color: zoneColor[zone] }]}>
              {zoneCounts[zone]}
            </Text>
            <Text style={styles.zoneSummaryText}>{zone}</Text>
          </View>
        ))}
      </View>

      <View style={styles.legendCard}>
        <Text style={styles.legendTitle}>Zone Meaning</Text>
        {zoneOrder.map((zone) => (
          <View key={zone} style={styles.legendRow}>
            <View style={[styles.zoneDot, { backgroundColor: zoneColor[zone] }]} />
            <Text style={styles.legendText}>
              {zone}: {zoneLabel[zone]}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.barsCard}>
        <Text style={styles.barsTitle}>Muscle Groups</Text>
        {sortedResults.length === 0 ? (
          <Text style={styles.emptyText}>Log workouts to populate weekly volume.</Text>
        ) : (
          sortedResults.map((result) => (
            <MuscleBar
              key={result.muscleGroupId}
              label={result.displayName}
              value={result.effectiveSets}
              maxValue={maxDisplayValue}
              zone={result.zone}
              optimalLow={result.thresholds.optimalLow}
              mrvHigh={result.thresholds.mrvHigh}
            />
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
    gap: 2,
  },
  heroTag: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroMetric: {
    color: theme.colors.zoneGreen,
    fontSize: theme.fontSize.hero,
    lineHeight: 40,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  heroTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  rangeLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  zoneSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  zoneSummaryChip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: theme.colors.bg2,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoneSummaryCount: {
    fontSize: theme.fontSize.sm,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  zoneSummaryText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
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
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoneDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  barsCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  barsTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
    fontSize: theme.fontSize.lg,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
});
