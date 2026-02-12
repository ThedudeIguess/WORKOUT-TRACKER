import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { theme } from '../constants/theme';

interface ProgressChartPoint {
  label: string;
  value: number;
}

interface ProgressTargetLine {
  label: string;
  value: number;
  color?: string;
}

interface ProgressChartProps {
  points: ProgressChartPoint[];
  color?: string;
  unitLabel?: string;
  targetLines?: ProgressTargetLine[];
}

export function ProgressChart({
  points,
  color = theme.colors.accent,
  unitLabel = 'kg',
  targetLines = [],
}: ProgressChartProps) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(260, Math.min(windowWidth - 60, 560));
  const height = 220;
  const paddingX = 24;
  const paddingY = 22;

  if (points.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyLabel}>No trend data yet.</Text>
      </View>
    );
  }

  const allValues = [...points.map((point) => point.value), ...targetLines.map((line) => line.value)];
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = Math.max(1, maxValue - minValue);

  const getY = (value: number): number => {
    const normalized = (value - minValue) / valueRange;
    return height - paddingY - normalized * (height - paddingY * 2);
  };

  const chartPoints = points.map((point, index) => {
    const x =
      paddingX +
      (index / Math.max(1, points.length - 1)) * (width - paddingX * 2);
    const y = getY(point.value);
    return { x, y, value: point.value };
  });

  const polylinePoints = chartPoints
    .map((point) => `${point.x},${point.y}`)
    .join(' ');

  const guides = Array.from({ length: 5 }, (_, index) => {
    const fraction = index / 4;
    const y = paddingY + fraction * (height - paddingY * 2);
    return {
      y,
      value: maxValue - fraction * valueRange,
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        {guides.map((guide, index) => (
          <Line
            key={`guide-${index}`}
            x1={paddingX}
            y1={guide.y}
            x2={width - paddingX}
            y2={guide.y}
            stroke={theme.colors.border}
            strokeWidth={1}
          />
        ))}

        {targetLines.map((target, index) => {
          const y = getY(target.value);
          const stroke = target.color ?? theme.colors.info;
          return (
            <G key={`target-${index}`}>
              <Line
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke={stroke}
                strokeWidth={1.2}
                strokeDasharray="6 4"
                opacity={0.8}
              />
              <SvgText
                x={paddingX + 2}
                y={y - 4}
                fill={stroke}
                fontSize="10"
                fontWeight="700"
              >
                {target.label}
              </SvgText>
            </G>
          );
        })}

        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {chartPoints.map((point, index) => (
          <Circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={color}
          />
        ))}
      </Svg>

      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>{points[0]?.label ?? ''}</Text>
        <Text style={styles.axisLabel}>{points[points.length - 1]?.label ?? ''}</Text>
      </View>

      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>
          Min {minValue.toFixed(1)} {unitLabel}
        </Text>
        <Text style={styles.axisLabel}>
          Max {maxValue.toFixed(1)} {unitLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  axisRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  emptyState: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLabel: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
});
