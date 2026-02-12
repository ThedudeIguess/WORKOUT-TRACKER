import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { JSX } from 'react';
import type { MuscleVolumeResult, VolumeZone } from '../types';

const zoneColor: Record<VolumeZone, string> = {
  RED: '#ff6b6b',
  YELLOW: '#f3c969',
  GREEN: '#45d6a8',
  AMBER: '#f0a561',
  ORANGE: '#ff8a5a',
};

const noDataColor = '#2a3548';
const silhouetteOutline = '#3a4a60';

type ShapeSpec =
  | {
      kind: 'ellipse';
      cx: number;
      cy: number;
      rx: number;
      ry: number;
    }
  | {
      kind: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      rx?: number;
      ry?: number;
    }
  | {
      kind: 'path';
      d: string;
    };

interface RegionSpec {
  muscleGroupId: string;
  shapes: ShapeSpec[];
}

interface MuscleMapSvgProps {
  view: 'front' | 'back';
  resultsByMuscle: Record<string, MuscleVolumeResult>;
  selectedMuscleId: string | null;
  onSelectMuscle: (muscleGroupId: string) => void;
}

const frontRegions: RegionSpec[] = [
  {
    muscleGroupId: 'chest',
    shapes: [
      { kind: 'ellipse', cx: 82, cy: 88, rx: 14, ry: 12 },
      { kind: 'ellipse', cx: 98, cy: 88, rx: 14, ry: 12 },
    ],
  },
  {
    muscleGroupId: 'front-delts',
    shapes: [
      { kind: 'ellipse', cx: 58, cy: 84, rx: 10, ry: 12 },
      { kind: 'ellipse', cx: 122, cy: 84, rx: 10, ry: 12 },
    ],
  },
  {
    muscleGroupId: 'side-delts',
    shapes: [
      { kind: 'ellipse', cx: 50, cy: 94, rx: 9, ry: 11 },
      { kind: 'ellipse', cx: 130, cy: 94, rx: 9, ry: 11 },
    ],
  },
  {
    muscleGroupId: 'biceps',
    shapes: [
      { kind: 'ellipse', cx: 51, cy: 122, rx: 9, ry: 14 },
      { kind: 'ellipse', cx: 129, cy: 122, rx: 9, ry: 14 },
    ],
  },
  {
    muscleGroupId: 'forearms',
    shapes: [
      { kind: 'ellipse', cx: 48, cy: 154, rx: 8, ry: 16 },
      { kind: 'ellipse', cx: 132, cy: 154, rx: 8, ry: 16 },
    ],
  },
  {
    muscleGroupId: 'abs',
    shapes: [{ kind: 'rect', x: 76, y: 104, width: 28, height: 56, rx: 8 }],
  },
  {
    muscleGroupId: 'obliques',
    shapes: [
      { kind: 'path', d: 'M66 108 L76 106 L76 158 L62 150 Z' },
      { kind: 'path', d: 'M114 108 L104 106 L104 158 L118 150 Z' },
    ],
  },
  {
    muscleGroupId: 'quads',
    shapes: [
      { kind: 'rect', x: 72, y: 186, width: 16, height: 82, rx: 7 },
      { kind: 'rect', x: 92, y: 186, width: 16, height: 82, rx: 7 },
    ],
  },
];

const backRegions: RegionSpec[] = [
  {
    muscleGroupId: 'upper-back',
    shapes: [{ kind: 'rect', x: 72, y: 76, width: 36, height: 36, rx: 10 }],
  },
  {
    muscleGroupId: 'lats',
    shapes: [
      { kind: 'path', d: 'M72 88 L56 116 L64 164 L78 138 L82 96 Z' },
      { kind: 'path', d: 'M108 88 L124 116 L116 164 L102 138 L98 96 Z' },
    ],
  },
  {
    muscleGroupId: 'lower-traps',
    shapes: [{ kind: 'path', d: 'M82 114 L98 114 L106 144 L74 144 Z' }],
  },
  {
    muscleGroupId: 'rear-delts',
    shapes: [
      { kind: 'ellipse', cx: 58, cy: 86, rx: 10, ry: 12 },
      { kind: 'ellipse', cx: 122, cy: 86, rx: 10, ry: 12 },
    ],
  },
  {
    muscleGroupId: 'triceps',
    shapes: [
      { kind: 'ellipse', cx: 54, cy: 122, rx: 9, ry: 14 },
      { kind: 'ellipse', cx: 126, cy: 122, rx: 9, ry: 14 },
    ],
  },
  {
    muscleGroupId: 'glutes',
    shapes: [
      { kind: 'ellipse', cx: 82, cy: 176, rx: 12, ry: 12 },
      { kind: 'ellipse', cx: 98, cy: 176, rx: 12, ry: 12 },
    ],
  },
  {
    muscleGroupId: 'hamstrings',
    shapes: [
      { kind: 'rect', x: 72, y: 188, width: 16, height: 78, rx: 7 },
      { kind: 'rect', x: 92, y: 188, width: 16, height: 78, rx: 7 },
    ],
  },
];

function getRegionColor(result: MuscleVolumeResult | undefined): string {
  if (!result || result.effectiveSets <= 0) {
    return noDataColor;
  }

  return zoneColor[result.zone];
}

function renderShape(
  shape: ShapeSpec,
  key: string,
  fill: string,
  stroke: string,
  strokeWidth: number,
  fillOpacity: number,
  onPress: () => void
): JSX.Element {
  if (shape.kind === 'ellipse') {
    return (
      <Ellipse
        key={key}
        cx={shape.cx}
        cy={shape.cy}
        rx={shape.rx}
        ry={shape.ry}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        onPress={onPress}
      />
    );
  }

  if (shape.kind === 'rect') {
    return (
      <Rect
        key={key}
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        rx={shape.rx ?? 0}
        ry={shape.ry ?? shape.rx ?? 0}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        onPress={onPress}
      />
    );
  }

  return (
    <Path
      key={key}
      d={shape.d}
      fill={fill}
      fillOpacity={fillOpacity}
      stroke={stroke}
      strokeWidth={strokeWidth}
      onPress={onPress}
    />
  );
}

function BodySilhouette({ view }: { view: 'front' | 'back' }) {
  return (
    <>
      <Circle cx={90} cy={30} r={18} fill="transparent" stroke={silhouetteOutline} strokeWidth={2} />
      <Rect x={66} y={50} width={48} height={116} rx={24} fill="transparent" stroke={silhouetteOutline} strokeWidth={2} />
      <Rect x={40} y={62} width={22} height={110} rx={11} fill="transparent" stroke={silhouetteOutline} strokeWidth={2} />
      <Rect x={118} y={62} width={22} height={110} rx={11} fill="transparent" stroke={silhouetteOutline} strokeWidth={2} />
      <Rect x={70} y={166} width={18} height={128} rx={9} fill="transparent" stroke={silhouetteOutline} strokeWidth={2} />
      <Rect x={92} y={166} width={18} height={128} rx={9} fill="transparent" stroke={silhouetteOutline} strokeWidth={2} />
      {view === 'back' ? (
        <Path
          d="M76 78 L90 98 L104 78"
          fill="none"
          stroke={silhouetteOutline}
          strokeWidth={2}
        />
      ) : null}
    </>
  );
}

export function MuscleMapSvg({
  view,
  resultsByMuscle,
  selectedMuscleId,
  onSelectMuscle,
}: MuscleMapSvgProps) {
  const regions = view === 'front' ? frontRegions : backRegions;

  return (
    <View style={styles.wrapper}>
      <Svg width={180} height={320} viewBox="0 0 180 320">
        <BodySilhouette view={view} />

        {regions.map((region) => {
          const result = resultsByMuscle[region.muscleGroupId];
          const fill = getRegionColor(result);
          const isSelected = selectedMuscleId === region.muscleGroupId;
          const isGreen = result?.zone === 'GREEN' && (result.effectiveSets ?? 0) > 0;
          const stroke = isSelected
            ? '#e8edf5'
            : isGreen
              ? '#45d6a8'
              : silhouetteOutline;

          return (
            <G key={`${view}-${region.muscleGroupId}`}>
              {isGreen
                ? region.shapes.map((shape, index) =>
                    renderShape(
                      shape,
                      `${view}-${region.muscleGroupId}-glow-${index}`,
                      fill,
                      '#45d6a8',
                      5,
                      0.25,
                      () => onSelectMuscle(region.muscleGroupId)
                    )
                  )
                : null}

              {region.shapes.map((shape, index) =>
                renderShape(
                  shape,
                  `${view}-${region.muscleGroupId}-${index}`,
                  fill,
                  stroke,
                  isSelected ? 2.2 : 1.2,
                  0.72,
                  () => onSelectMuscle(region.muscleGroupId)
                )
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e2d42',
    backgroundColor: '#0a0f18',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
