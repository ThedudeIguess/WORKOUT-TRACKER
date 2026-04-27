import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import {
  calculateMevTrainingHistory,
  calculateMuscleProgressionHistoryFromWeeks,
  getAllMuscleProgressionsFromWeeks,
  identifyLaggingMuscles,
  summarizeWeekVolumeAgainstMev,
  type LaggingMuscleResult,
  type MevWeekSummary,
} from '../../utils/mevTrainingWeek';
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

function formatRange(startIso: string, endIso: string): string {
  return `${new Date(startIso).toLocaleDateString()} - ${new Date(endIso).toLocaleDateString()}`;
}

export default function BodyMapScreen() {
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weekHistory, setWeekHistory] = useState<MevWeekSummary[]>([]);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(1);
  const [selectedMuscleId, setSelectedMuscleId] = useState<string>('quads');
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
        return;
      }

      const history = await calculateMevTrainingHistory(anchor, nowIso);
      setWeekHistory(history.weeks);
      setSelectedWeekNumber(history.currentWeek?.weekNumber ?? history.calendarWeekNumber);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Could not load muscle map.'
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

  const selectedTrainingWeekNumber = useMemo(
    () =>
      weekHistory.filter(
        (week) =>
          week.weekNumber <= (selectedWeek?.weekNumber ?? 0) &&
          week.qualifiesAsTrainingWeek
      ).length,
    [selectedWeek, weekHistory]
  );

  const resultsByMuscle = useMemo(() => {
    const map: Record<string, MuscleVolumeResult> = {};
    for (const result of selectedWeek?.results ?? []) {
      map[result.muscleGroupId] = result;
    }
    return map;
  }, [selectedWeek]);

  const selectedResult = useMemo(() => {
    return (
      selectedWeek?.results.find((result) => result.muscleGroupId === selectedMuscleId) ??
      null
    );
  }, [selectedWeek, selectedMuscleId]);

  const selectedMuscleDisplay =
    selectedResult?.displayName ??
    muscleGroups.find((muscle) => muscle.id === selectedMuscleId)?.displayName ??
    'Muscle';

  const muscleProgression = useMemo(
    () => calculateMuscleProgressionHistoryFromWeeks(weekHistory, selectedMuscleId),
    [selectedMuscleId, weekHistory]
  );

  const selectedMuscleContributions = useMemo(
    () => selectedWeek?.exerciseContributionsByMuscle[selectedMuscleId] ?? [],
    [selectedWeek, selectedMuscleId]
  );

  const selectedMuscleWeekStatus = useMemo(
    () =>
      muscleProgression?.weeks.find(
        (week) => week.calendarWeekNumber === (selectedWeek?.weekNumber ?? 0)
      ) ?? null,
    [muscleProgression, selectedWeek]
  );

  const selectedMusclePhase =
    muscleProgression?.currentPhase ?? null;

  const allMuscleProgressions = useMemo(
    () => getAllMuscleProgressionsFromWeeks(weekHistory),
    [weekHistory]
  );

  const laggingMuscles = useMemo<LaggingMuscleResult[]>(
    () => identifyLaggingMuscles(allMuscleProgressions, 3).slice(0, 5),
    [allMuscleProgressions]
  );

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
        <Text style={styles.heroTag}>Muscle Progress Map</Text>
        <Text style={styles.heroWeek}>
          Training Week {selectedTrainingWeekNumber}
        </Text>
        <Text style={styles.heroRange}>
          {selectedWeek
            ? `Calendar Week ${selectedWeek.weekNumber} • ${formatRange(selectedWeek.startIso, selectedWeek.endIso)}`
            : 'No week selected'}
          </Text>
      </View>

      {loadError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : null}

      <View style={styles.explainerCard}>
        <Text style={styles.explainerTitle}>How to read it</Text>
        <Text style={styles.explainerText}>
          Calendar weeks are real time. Muscle weeks only advance when that muscle hits its MEV for that week.
          If triceps hits MEV six times, triceps is M6; if abs only hits once, abs stays M1.
        </Text>
      </View>

      <View style={styles.weekHistoryCard}>
        <Text style={styles.weekHistoryTitle}>Calendar Weeks</Text>
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
              </Pressable>
            );
          })}
        </ScrollView>
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

      <View style={styles.boardCard}>
        <Text style={styles.boardTitle}>Muscle Week Board</Text>
        <Text style={styles.boardSubtitle}>
          M-week advances only when that muscle hits MEV in a calendar week.
        </Text>
        <View style={styles.boardHeaderRow}>
          <Text style={styles.boardHeaderName}>Muscle</Text>
          <Text style={styles.boardHeaderMetric}>M-week</Text>
          <Text style={styles.boardHeaderMetric}>MEV hit/active</Text>
        </View>
        <View style={styles.boardRows}>
          {allMuscleProgressions.map((progression) => {
            const isSelected = progression.muscleGroupId === selectedMuscleId;
            return (
              <Pressable
                key={progression.muscleGroupId}
                onPress={() => setSelectedMuscleId(progression.muscleGroupId)}
                style={({ pressed }) => [
                  styles.boardRow,
                  isSelected && styles.boardRowSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.boardRowName}>{progression.displayName}</Text>
                <Text style={styles.boardRowMetric}>
                  M{progression.currentMuscleWeekNumber}
                </Text>
                <Text style={styles.boardRowMetric}>
                  {progression.hitWeeks}/{progression.activeWeeks}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.laggingCard}>
        <Text style={styles.laggingTitle}>Lagging Muscles (Opportunity-Adjusted)</Text>
        <Text style={styles.laggingSubtitle}>
          Compared by MEV hit rate across weeks each muscle was actually active.
        </Text>
        {laggingMuscles.length === 0 ? (
          <Text style={styles.laggingNone}>No clear lagging muscles yet (insufficient gap/data).</Text>
        ) : (
          laggingMuscles.map((muscle) => (
            <View key={muscle.muscleGroupId} style={styles.laggingRow}>
              <Text style={styles.laggingRowName}>{muscle.displayName}</Text>
              <Text style={styles.laggingRowMetric}>
                {muscle.hitWeeks}/{muscle.activeWeeks} hit
              </Text>
              <Text style={styles.laggingRowGap}>
                -{muscle.weeksBehindExpected.toFixed(1)} wk
              </Text>
            </View>
          ))
        )}
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
          Muscle week (current): {muscleProgression?.currentMuscleWeekNumber ?? 0}
        </Text>
        <Text style={styles.detailText}>
          Muscle week (selected calendar week): {selectedMuscleWeekStatus?.muscleWeekNumber ?? 0}
        </Text>
        <Text style={styles.detailText}>
          MEV hits vs active weeks: {muscleProgression?.hitWeeks ?? 0}/{muscleProgression?.activeWeeks ?? 0}
        </Text>
        <Text style={styles.detailText}>
          This week MEV: {selectedMuscleWeekStatus?.percentOfMev ?? 0}%
          {' '}({selectedMuscleWeekStatus?.hitMev ? 'hit' : 'missed'})
        </Text>

        <View style={styles.phaseCard}>
          <Text style={styles.phaseTitle}>
            {selectedMusclePhase?.title ?? 'No phase yet'}
          </Text>
          <Text style={styles.phaseDescription}>
            {selectedMusclePhase?.description ??
              'This muscle has not accumulated enough counted weeks yet.'}
          </Text>
        </View>

        <Text style={styles.timelineTitle}>Contributing Exercises (this week)</Text>
        {selectedMuscleContributions.length === 0 ? (
          <Text style={styles.contributionsEmpty}>
            No sets logged for this muscle in the selected week.
          </Text>
        ) : (
          <View style={styles.contributionsList}>
            {selectedMuscleContributions.slice(0, 6).map((contribution) => (
              <View key={contribution.exerciseId} style={styles.contributionRow}>
                <Text style={styles.contributionName} numberOfLines={1}>
                  {contribution.exerciseName}
                </Text>
                <Text style={styles.contributionSets}>
                  {contribution.effectiveSets.toFixed(1)} eff
                </Text>
                <Text style={styles.contributionRaw}>
                  {contribution.setCount}x
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.timelineTitle}>Muscle Week Timeline</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timelineRow}
        >
          {(muscleProgression?.weeks ?? []).map((week) => {
            const isSelected = week.calendarWeekNumber === (selectedWeek?.weekNumber ?? 0);
            return (
              <View
                key={week.calendarWeekNumber}
                style={[styles.timelineChip, isSelected && styles.timelineChipSelected]}
              >
                <Text style={styles.timelineWeekLabel}>W{week.calendarWeekNumber}</Text>
                <Text style={styles.timelineMuscleWeekLabel}>M{week.muscleWeekNumber}</Text>
                <Text
                  style={[
                    styles.timelineStatus,
                    week.hitMev ? styles.timelineStatusHit : styles.timelineStatusMiss,
                  ]}
                >
                  {week.hitMev ? 'MEV hit' : 'MEV miss'}
                </Text>
              </View>
            );
          })}
        </ScrollView>
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
  explainerCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: 4,
  },
  explainerTitle: {
    color: theme.colors.info,
    fontSize: theme.fontSize.sm,
    fontWeight: '900',
  },
  explainerText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    lineHeight: 18,
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
  weekHistoryRow: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.lg,
  },
  weekChip: {
    minWidth: 80,
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
    fontSize: theme.fontSize.md,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  weekChipValueSelected: {
    color: theme.colors.accent,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 130,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  legendText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  boardCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  boardTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.md,
  },
  boardSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
  },
  boardRows: {
    gap: 6,
  },
  boardHeaderRow: {
    minHeight: 28,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bg1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boardHeaderName: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  boardHeaderMetric: {
    minWidth: 66,
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '900',
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  boardRow: {
    minHeight: 42,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg3,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boardRowSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentDim,
  },
  boardRowName: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  boardRowMetric: {
    minWidth: 66,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  laggingCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  laggingTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.md,
  },
  laggingSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
  },
  laggingNone: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontStyle: 'italic',
  },
  laggingRow: {
    minHeight: 36,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg3,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  laggingRowName: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  laggingRowMetric: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  laggingRowGap: {
    color: theme.colors.warning,
    fontSize: theme.fontSize.xs,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
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
    fontSize: theme.fontSize.md,
    fontWeight: '800',
  },
  detailText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  phaseCard: {
    marginTop: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
    padding: theme.spacing.sm,
    gap: 4,
  },
  phaseTitle: {
    color: theme.colors.info,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
  },
  phaseDescription: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    lineHeight: 16,
  },
  timelineTitle: {
    marginTop: 8,
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
  },
  timelineRow: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.md,
  },
  timelineChip: {
    minWidth: 80,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  timelineChipSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentDim,
  },
  timelineWeekLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timelineMuscleWeekLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.sm,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  timelineStatus: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  timelineStatusHit: {
    color: theme.colors.accent,
  },
  timelineStatusMiss: {
    color: theme.colors.warning,
  },
  contributionsList: {
    gap: 4,
    marginTop: 4,
  },
  contributionsEmpty: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontStyle: 'italic',
    marginTop: 4,
  },
  contributionRow: {
    minHeight: 32,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg3,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contributionName: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  contributionSets: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.xs,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    minWidth: 56,
    textAlign: 'right',
  },
  contributionRaw: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 30,
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.7,
  },
});
