import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  RED: '#ff6b6b',
  YELLOW: '#f3c969',
  GREEN: '#45d6a8',
  AMBER: '#f0a561',
  ORANGE: '#ff8a5a',
};
const zoneLabel: Record<VolumeZone, string> = {
  RED: 'Under MEV',
  YELLOW: 'MEV to Opt',
  GREEN: 'Optimal',
  AMBER: 'High',
  ORANGE: 'Above MRV',
};

export default function VolumeDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [rangeLabel, setRangeLabel] = useState('');
  const [weekLabel, setWeekLabel] = useState('Week 1');
  const [results, setResults] = useState<MuscleVolumeResult[]>([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const load = async () => {
        setLoading(true);
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

          if (mounted) {
            setWeekLabel(`Week ${weekWindow.weekNumber + 1}`);
            setRangeLabel(
              `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
            );
            setResults(data);
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

  const maxDisplayValue = Math.max(
    14,
    ...results.map((result) => result.thresholds.mrvHigh)
  );

  const sortedResults = useMemo(
    () =>
      [...results].sort((left, right) => {
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
        <Text style={styles.heroTag}>Weekly Volume</Text>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <Text style={styles.rangeLabel}>{rangeLabel}</Text>
      </View>

      <View style={styles.zoneSummaryRow}>
        {zoneOrder.map((zone) => (
          <View key={zone} style={styles.zoneSummaryChip}>
            <View style={[styles.zoneDot, { backgroundColor: zoneColor[zone] }]} />
            <Text style={styles.zoneSummaryText}>
              {zone}: {zoneCounts[zone]}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.legendCard}>
        <Text style={styles.legendTitle}>Zone Meaning</Text>
        {zoneOrder.map((zone) => (
          <View key={zone} style={styles.legendRow}>
            <View style={[styles.zoneDot, { backgroundColor: zoneColor[zone] }]} />
            <Text style={styles.legendText}>
              {zone} - {zoneLabel[zone]}
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
  weekLabel: {
    color: '#ebf3ff',
    fontSize: 23,
    fontWeight: '900',
  },
  rangeLabel: {
    color: '#b2c7e3',
    fontSize: 13,
    fontWeight: '700',
  },
  zoneSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  zoneSummaryChip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334d70',
    backgroundColor: '#101d31',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoneDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  zoneSummaryText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  legendCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#31486a',
    backgroundColor: '#101b2c',
    padding: 12,
    gap: 6,
  },
  legendTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  barsCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#304868',
    backgroundColor: '#0f192a',
    padding: 12,
    gap: 10,
  },
  barsTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
    fontSize: 15,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
});
