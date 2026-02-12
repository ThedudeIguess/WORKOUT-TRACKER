import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import type { VolumeZone } from '../types';

const zoneColor: Record<VolumeZone, string> = {
  RED: theme.colors.zoneRed,
  YELLOW: theme.colors.zoneYellow,
  GREEN: theme.colors.zoneGreen,
  AMBER: theme.colors.zoneAmber,
  ORANGE: theme.colors.zoneOrange,
};

interface MuscleBarProps {
  label: string;
  value: number;
  maxValue: number;
  zone: VolumeZone;
  optimalLow?: number;
  mrvHigh?: number;
}

export function MuscleBar({
  label,
  value,
  maxValue,
  zone,
  optimalLow,
  mrvHigh,
}: MuscleBarProps) {
  const normalized = maxValue > 0 ? Math.min(1, value / maxValue) : 0;
  const optimalMarker =
    typeof optimalLow === 'number' && maxValue > 0
      ? Math.min(1, Math.max(0, optimalLow / maxValue))
      : null;
  const mrvMarker =
    typeof mrvHigh === 'number' && maxValue > 0
      ? Math.min(1, Math.max(0, mrvHigh / maxValue))
      : null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color: zoneColor[zone] }]}>
          {value.toFixed(1)}
        </Text>
      </View>

      <View style={styles.track}>
        {optimalMarker !== null ? (
          <View style={[styles.marker, { left: `${optimalMarker * 100}%` }]} />
        ) : null}
        {mrvMarker !== null ? (
          <View style={[styles.marker, styles.markerMrv, { left: `${mrvMarker * 100}%` }]} />
        ) : null}
        <View
          style={[
            styles.fill,
            {
              width: `${normalized * 100}%`,
              backgroundColor: zoneColor[zone],
            },
          ]}
        >
          <View style={styles.fillGloss} />
        </View>
      </View>

      {(optimalLow ?? mrvHigh) !== undefined ? (
        <View style={styles.thresholdRow}>
          <Text style={styles.thresholdLabel}>
            {typeof optimalLow === 'number' ? `OPT ${optimalLow.toFixed(0)}` : ''}
          </Text>
          <Text style={styles.thresholdLabel}>
            {typeof mrvHigh === 'number' ? `MRV ${mrvHigh.toFixed(0)}` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: theme.fontSize.md,
  },
  value: {
    fontWeight: '900',
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: theme.colors.bg1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  marker: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    width: 2,
    backgroundColor: '#d0deef',
    opacity: 0.8,
    zIndex: 2,
  },
  markerMrv: {
    backgroundColor: theme.colors.zoneOrange,
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    justifyContent: 'flex-start',
  },
  fillGloss: {
    height: '50%',
    backgroundColor: '#ffffff33',
  },
  thresholdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  thresholdLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
