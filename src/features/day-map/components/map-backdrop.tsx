// Sand, sea band and shoreline under the day map, drawn as the panel's
// MapBackdrop (core web/shared/src/map/kit/MapBackdrop.tsx): see ../backdrop.ts.
// Rendered inside the camera transform of MapCanvas, in map units.
import { memo, useId } from 'react';
import { Circle, Defs, G, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';

import type { BeachMap } from '@/api/types';

import {
  BACKDROP,
  backdropColours,
  GRAIN_DOTS,
  PATTERN_TILE,
  shoreFrame,
  shorePath,
  WAVES_PATH,
} from '../backdrop';
import { MIN_LABEL_DP, seaRect } from '../geometry';
import type { MapPalette } from '../palette';

export interface MapBackdropProps {
  map: Pick<BeachMap, 'width' | 'height' | 'sea_side'>;
  palette: MapPalette;
  /** Visible name of the sea band ("Mare"). */
  seaLabel: string;
  /** Camera scale (dp per map unit): the label is hidden below MIN_LABEL_DP on screen. */
  k: number;
}

export const MapBackdrop = memo(function MapBackdrop({
  map,
  palette,
  seaLabel,
  k,
}: MapBackdropProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const colours = backdropColours(palette);
  const sea = seaRect(map);
  const { width, height, sea_side } = map;
  const depth = Math.min(sea.width, sea.height);
  const frame = shoreFrame(sea_side, width, height);
  const shore = shorePath(frame.length, depth);
  const foam = shorePath(frame.length, depth, depth * BACKDROP.foamOffset);
  const vertical = sea_side === 'left' || sea_side === 'right';
  const cx = sea.x + sea.width / 2;
  const cy = sea.y + sea.height / 2;
  const font = depth * BACKDROP.labelSize;
  const grain = `${id}-grain`;
  const waves = `${id}-waves`;

  return (
    <G>
      <Defs>
        <Pattern
          id={grain}
          width={PATTERN_TILE}
          height={PATTERN_TILE}
          patternUnits="userSpaceOnUse"
          patternTransform={`scale(${BACKDROP.grainScale})`}
        >
          {GRAIN_DOTS.map(([x, y, r]) => (
            <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={colours.grain} />
          ))}
        </Pattern>
        <Pattern
          id={waves}
          width={PATTERN_TILE}
          height={PATTERN_TILE}
          patternUnits="userSpaceOnUse"
          patternTransform={`${vertical ? 'rotate(90) ' : ''}scale(${BACKDROP.wavesScale})`}
        >
          <Path
            d={WAVES_PATH}
            fill="none"
            stroke={colours.wave}
            strokeWidth={BACKDROP.waveStroke}
            strokeLinecap="round"
          />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={colours.sand} />
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={`url(#${grain})`}
        opacity={BACKDROP.grainOpacity}
      />
      <Rect x={sea.x} y={sea.y} width={sea.width} height={sea.height} fill={colours.sea} />
      <G transform={frame.transform}>
        <Path d={shore.fill} fill={colours.sea} />
        <Path
          d={foam.line}
          fill="none"
          stroke={colours.wave}
          strokeWidth={BACKDROP.foamStroke}
          opacity={BACKDROP.foamOpacity}
        />
        <Path d={shore.line} fill="none" stroke={colours.wave} strokeWidth={BACKDROP.waveStroke} />
      </G>
      <Rect
        x={sea.x}
        y={sea.y}
        width={sea.width}
        height={sea.height}
        fill={`url(#${waves})`}
        opacity={BACKDROP.wavesOpacity}
      />
      {seaLabel && font * k >= MIN_LABEL_DP ? (
        <SvgText
          x={cx}
          // No dominant-baseline on every platform: 0.35 em below the centre is the visual centre.
          y={cy + font * 0.35}
          fontSize={font}
          fontWeight={BACKDROP.labelWeight}
          letterSpacing={font * BACKDROP.labelTracking}
          fill={colours.label}
          opacity={BACKDROP.labelOpacity}
          textAnchor="middle"
          transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}
          testID="day-map-sea-label"
        >
          {seaLabel}
        </SvgText>
      ) : null}
    </G>
  );
});
