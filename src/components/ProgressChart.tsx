import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { theme } from '../constants/theme';

interface ProgressChartPoint {
  label: string;
  value: number;
}

interface ProgressChartProps {
  points: ProgressChartPoint[];
  color?: string;
  unitLabel?: string;
}

export function ProgressChart({
  points,
  color = theme.colors.info,
  unitLabel = 'kg',
}: ProgressChartProps) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(260, Math.min(windowWidth - 60, 520));
  const height = 196;
  const paddingX = 20;
  const paddingY = 18;

  if (points.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyLabel}>No trend data yet.</Text>
      </View>
    );
  }

  const minValue = Math.min(...points.map((point) => point.value));
  const maxValue = Math.max(...points.map((point) => point.value));
  const valueRange = Math.max(1, maxValue - minValue);

  const chartPoints = points.map((point, index) => {
    const x =
      paddingX +
      (index / Math.max(1, points.length - 1)) * (width - paddingX * 2);
    const normalized = (point.value - minValue) / valueRange;
    const y = height - paddingY - normalized * (height - paddingY * 2);
    return { x, y, value: point.value };
  });

  const polylinePoints = chartPoints
    .map((point) => `${point.x},${point.y}`)
    .join(' ');

  const topGuideY = paddingY;
  const midGuideY = height / 2;
  const bottomGuideY = height - paddingY;

  return (
    <View style={styles.container}>
      <View style={styles.yAxisLabels}>
        <Text style={styles.axisLabel}>
          {maxValue.toFixed(1)} {unitLabel}
        </Text>
        <Text style={styles.axisLabel}>
          {minValue.toFixed(1)} {unitLabel}
        </Text>
      </View>

      <Svg width={width} height={height}>
        <Line
          x1={paddingX}
          y1={topGuideY}
          x2={width - paddingX}
          y2={topGuideY}
          stroke="#2a3b59"
          strokeWidth={1}
        />
        <Line
          x1={paddingX}
          y1={midGuideY}
          x2={width - paddingX}
          y2={midGuideY}
          stroke="#24344f"
          strokeWidth={1}
        />
        <Line
          x1={paddingX}
          y1={bottomGuideY}
          x2={width - paddingX}
          y2={bottomGuideY}
          stroke="#2a3b59"
          strokeWidth={1}
        />
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {chartPoints.map((point, index) => (
          <Circle key={index} cx={point.x} cy={point.y} r={4} fill={color} />
        ))}
      </Svg>

      <View style={styles.xAxisRow}>
        <Text style={styles.axisLabel}>{points[0]?.label ?? ''}</Text>
        <Text style={styles.axisLabel}>{points[points.length - 1]?.label ?? ''}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#304663',
    backgroundColor: '#111d30',
    padding: 10,
    gap: 8,
    alignItems: 'center',
  },
  yAxisLabels: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xAxisRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    color: '#9db7d9',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#304663',
    backgroundColor: '#111d30',
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLabel: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
});
