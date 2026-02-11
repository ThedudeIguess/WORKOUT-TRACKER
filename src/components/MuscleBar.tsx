import { StyleSheet, Text, View } from 'react-native';
import type { VolumeZone } from '../types';
import { theme } from '../constants/theme';

const zoneColor: Record<VolumeZone, string> = {
  RED: '#ff6b6b',
  YELLOW: '#f3c969',
  GREEN: '#45d6a8',
  AMBER: '#f0a561',
  ORANGE: '#ff8a5a',
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
        <View style={[styles.valuePill, { borderColor: zoneColor[zone] }]}>
          <Text style={[styles.value, { color: zoneColor[zone] }]}>
            {value.toFixed(1)} | {zone}
          </Text>
        </View>
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
        />
      </View>

      {(optimalLow ?? mrvHigh) !== undefined ? (
        <View style={styles.thresholdRow}>
          <Text style={styles.thresholdLabel}>
            {typeof optimalLow === 'number' ? `Opt >= ${optimalLow.toFixed(0)}` : ''}
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
    gap: 7,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  valuePill: {
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#131f33',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  value: {
    fontWeight: '800',
    fontSize: 11,
  },
  track: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#d9e4f5',
    opacity: 0.55,
  },
  markerMrv: {
    backgroundColor: '#ffb07a',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  thresholdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  thresholdLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
});
