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
import { MuscleBar } from '../../components/MuscleBar';
import { theme } from '../../constants/theme';
import { getFirstWorkoutAnchor } from '../../db/queries';
import type { VolumeZone } from '../../types';
import {
  calculateMevTrainingHistory,
  summarizeWeekVolumeAgainstMev,
  type MevWeekSummary,
} from '../../utils/mevTrainingWeek';
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

function formatRange(startIso: string, endIso: string): string {
  return `${new Date(startIso).toLocaleDateString()} - ${new Date(endIso).toLocaleDateString()}`;
}

export default function VolumeDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarWeekLabel, setCalendarWeekLabel] = useState('Calendar Week 1');
  const [trainingWeekLabel, setTrainingWeekLabel] = useState('Training Week 0');
  const [weekHistory, setWeekHistory] = useState<MevWeekSummary[]>([]);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) {
      setLoading(true);
    }

    try {
      setLoadError(null);
      const anchor = await getFirstWorkoutAnchor();
      const nowIso = new Date().toISOString();

      if (!anchor) {
        const window = getRollingWeekWindow(nowIso, nowIso);
        const results = await calculateVolumeForDateRange(window.startIso, window.endIso);
        const fallbackWeek = summarizeWeekVolumeAgainstMev(
          1,
          window.startIso,
          window.endIso,
          results
        );

        setWeekHistory([fallbackWeek]);
        setSelectedWeekNumber(1);
        setCalendarWeekLabel('Calendar Week 1');
        setTrainingWeekLabel('Training Week 0');
        return;
      }

      const history = await calculateMevTrainingHistory(anchor, nowIso);
      setWeekHistory(history.weeks);
      setSelectedWeekNumber(history.currentWeek?.weekNumber ?? history.calendarWeekNumber);
      setCalendarWeekLabel(`Calendar Week ${history.calendarWeekNumber}`);
      setTrainingWeekLabel(`Training Week ${history.trainingWeekNumber}`);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Could not load volume dashboard.'
      );
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

  const selectedWeek = useMemo(
    () =>
      weekHistory.find((week) => week.weekNumber === selectedWeekNumber) ??
      weekHistory[weekHistory.length - 1] ??
      null,
    [selectedWeekNumber, weekHistory]
  );

  const results = useMemo(() => selectedWeek?.results ?? [], [selectedWeek]);

  const maxDisplayValue = useMemo(
    () => Math.max(14, ...results.map((result) => result.thresholds.mrvHigh)),
    [results]
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
        <Text style={styles.heroTag}>MEV WEEKLY DASHBOARD</Text>
        <Text style={styles.heroMetric}>{selectedWeek?.averageMevPercent ?? 0}%</Text>
        <Text style={styles.heroTitle}>average MEV coverage (Lower/Upper/Back/Arms groups)</Text>
        <Text style={styles.rangeLabel}>{`${trainingWeekLabel} • ${calendarWeekLabel}`}</Text>
        <Text style={styles.rangeSubLabel}>
          {selectedWeek
            ? `Viewing Week ${selectedWeek.weekNumber} • ${formatRange(selectedWeek.startIso, selectedWeek.endIso)}`
            : 'No week selected'}
        </Text>
      </View>

      {loadError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : null}

      <View style={styles.groupCoverageCard}>
        <Text style={styles.groupCoverageTitle}>Coverage Group Averages</Text>
        <View style={styles.groupCoverageRow}>
          {(selectedWeek?.coverageGroups ?? []).map((group) => (
            <View key={group.groupId} style={styles.groupCoverageChip}>
              <Text style={styles.groupCoverageLabel}>{group.label}</Text>
              <Text style={styles.groupCoverageValue}>{group.averagePercent}%</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.weekHistoryCard}>
        <Text style={styles.weekHistoryTitle}>MEV by Week</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekHistoryRow}
        >
          {weekHistory.map((week) => {
            const isSelected = week.weekNumber === (selectedWeek?.weekNumber ?? 0);
            return (
              <Pressable
                key={week.weekNumber}
                onPress={() => setSelectedWeekNumber(week.weekNumber)}
                style={({ pressed }) => [
                  styles.weekChip,
                  isSelected && styles.weekChipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.weekChipLabel, isSelected && styles.weekChipLabelSelected]}>
                  W{week.weekNumber}
                </Text>
                <Text style={[styles.weekChipValue, isSelected && styles.weekChipValueSelected]}>
                  {week.averageMevPercent}%
                </Text>
                <Text
                  style={[
                    styles.weekChipStatus,
                    week.qualifiesAsTrainingWeek
                      ? styles.weekChipStatusGood
                      : styles.weekChipStatusLow,
                  ]}
                >
                  {week.qualifiesAsTrainingWeek ? 'counted' : 'not counted'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
        <Text style={styles.barsSubtitle}>
          {optimalCount} of {results.length} muscles in optimal zone for this selected week
        </Text>
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
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  rangeLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  rangeSubLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontVariant: ['tabular-nums'],
  },
  errorCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    backgroundColor: '#3a1b22',
    padding: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  weekHistoryCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  weekHistoryTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.md,
  },
  groupCoverageCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  groupCoverageTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.md,
  },
  groupCoverageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  groupCoverageChip: {
    minWidth: 84,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
  },
  groupCoverageLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  groupCoverageValue: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.md,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  weekHistoryRow: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.lg,
  },
  weekChip: {
    minWidth: 84,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg3,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  weekChipSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentDim,
  },
  weekChipLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  weekChipLabelSelected: {
    color: theme.colors.textPrimary,
  },
  weekChipValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.lg,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  weekChipValueSelected: {
    color: theme.colors.accent,
  },
  weekChipStatus: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  weekChipStatusGood: {
    color: theme.colors.accent,
  },
  weekChipStatusLow: {
    color: theme.colors.warning,
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
  barsSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
  pressed: {
    opacity: 0.7,
  },
});
