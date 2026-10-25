// SVG drawing of the day map (react-native-svg): sand, sea band,
// decorations and the spots with their status colour, glyph and label.
// Drawn in map units under one transform, so panning or zooming changes a
// single attribute; spots are memoised and culled to the visible area, so a
// map of hundreds of spots stays smooth (ADR 0008).
import { memo, useMemo } from 'react';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { MapDocument } from '@/api/types';

import {
  cull,
  labelFontSize,
  MIN_LABEL_DP,
  quantiseScale,
  seaRect,
  visibleRect,
  type Camera,
  type Size,
} from '../geometry';
import { GLYPH_PATHS, glyphStrokeWidth, STATUS_GLYPHS } from '../glyphs';
import { localized, type DaySpot } from '../model';
import { SPOT_STROKE_OPACITY, type MapPalette } from '../palette';

export interface MapCanvasProps {
  document: MapDocument;
  spots: readonly DaySpot[];
  camera: Camera;
  viewport: Size;
  /** Extra drawn area around the viewport, in viewports per side (pan without blanks). */
  overscan: number;
  palette: MapPalette;
  locale: string;
  seaLabel: string;
  selectedId?: string;
  /** Spots matching the search: ringed; the others are dimmed while a search is active. */
  matches?: ReadonlySet<string>;
}

export function MapCanvas({
  document,
  spots,
  camera,
  viewport,
  overscan,
  palette,
  locale,
  seaLabel,
  selectedId,
  matches,
}: MapCanvasProps) {
  const ox = viewport.width * overscan;
  const oy = viewport.height * overscan;
  const kq = quantiseScale(camera.k);
  const rect = visibleRect(camera, viewport, overscan);
  // Labels and captions hang below the shapes: a margin keeps them drawn at the edges.
  const visible = useMemo(
    () => cull(spots, rect, 40),
    // The rect is recomputed every render; its numbers are what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spots, rect.x, rect.y, rect.width, rect.height],
  );
  const decorations = useMemo(
    () => cull(document.decorations, rect, 20),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [document.decorations, rect.x, rect.y, rect.width, rect.height],
  );
  const { map } = document;
  const sea = seaRect(map);
  const seaFont = Math.min(sea.width, sea.height) * 0.35;

  return (
    <Svg
      width={viewport.width + ox * 2}
      height={viewport.height + oy * 2}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="day-map-canvas"
    >
      <G transform={`translate(${camera.tx + ox} ${camera.ty + oy}) scale(${camera.k})`}>
        <Rect x={0} y={0} width={map.width} height={map.height} fill={palette.sand} />
        <Rect x={sea.x} y={sea.y} width={sea.width} height={sea.height} fill={palette.sea} />
        {seaFont * camera.k >= MIN_LABEL_DP ? (
          <SvgText
            x={sea.x + sea.width / 2}
            y={sea.y + sea.height / 2 + seaFont * 0.35}
            fontSize={seaFont}
            fill={palette.seaLabel}
            textAnchor="middle"
          >
            {seaLabel}
          </SvgText>
        ) : null}
        {decorations.map((d) => (
          <DecorationNode
            key={d.id}
            x={d.x}
            y={d.y}
            rotation={d.rotation}
            shape={d.shape}
            label={localized(d.label, locale)}
            k={kq}
            palette={palette}
          />
        ))}
        {visible.map((s) => (
          <SpotNode
            key={s.id}
            spot={s}
            k={kq}
            palette={palette}
            selected={s.id === selectedId}
            matched={!!matches?.has(s.id)}
            dimmed={!!matches && matches.size > 0 && !matches.has(s.id)}
          />
        ))}
      </G>
    </Svg>
  );
}

const DecorationNode = memo(function DecorationNode({
  x,
  y,
  rotation,
  shape,
  label,
  k,
  palette,
}: {
  x: number;
  y: number;
  rotation: number;
  shape: MapDocument['decorations'][number]['shape'];
  label?: string;
  k: number;
  palette: MapPalette;
}) {
  const font = labelFontSize(Math.min(shape.w, shape.h), 0.4, k, 0.9);
  return (
    <G transform={`translate(${x} ${y})`}>
      <G transform={rotation ? `rotate(${rotation})` : undefined}>
        {shape.type === 'circle' ? (
          <Circle
            r={shape.w / 2}
            fill={palette.decoration}
            stroke={palette.decorationStroke}
            strokeWidth={1 / k}
          />
        ) : (
          <Rect
            x={-shape.w / 2}
            y={-shape.h / 2}
            width={shape.w}
            height={shape.h}
            rx={Math.min(shape.w, shape.h) * 0.15}
            fill={palette.decoration}
            stroke={palette.decorationStroke}
            strokeWidth={1 / k}
          />
        )}
      </G>
      {label && font > 0 ? (
        <SvgText y={font * 0.35} fontSize={font} fill={palette.decorationLabel} textAnchor="middle">
          {truncate(label, Math.max(shape.w, shape.h), font)}
        </SvgText>
      ) : null}
    </G>
  );
});

/** Shortens `text` to what fits in `width` map units at `font` (average glyph ≈ 0.55 em). */
export function truncate(text: string, width: number, font: number): string {
  const max = Math.max(1, Math.floor(width / (font * 0.55)));
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`;
}

const SpotNode = memo(function SpotNode({
  spot,
  k,
  palette,
  selected,
  matched,
  dimmed,
}: {
  spot: DaySpot;
  k: number;
  palette: MapPalette;
  selected: boolean;
  matched: boolean;
  dimmed: boolean;
}) {
  const { shape } = spot;
  const w = shape.w;
  const h = shape.type === 'circle' ? shape.w : shape.h;
  const colours = spot.status ? palette.status[spot.status] : null;
  const fill = colours?.fill ?? palette.unknown;
  const fg = colours?.foreground ?? palette.spotStroke;
  const glyph = spot.status ? STATUS_GLYPHS[spot.status] : null;
  // The badge stays at least 14 dp wide, in the top-right corner of the shape.
  const badgeR = Math.max(Math.min(w, h) * 0.22, 7 / k);
  const badgeX = w * 0.36;
  const badgeY = -h * 0.36;
  const font = labelFontSize(Math.min(w, h), 0.34, k);
  const captionFont = (MIN_LABEL_DP * 1.1) / k;
  const showCaption = !!spot.caption && captionFont <= h * 0.45;
  const ring = (outset: number, props: object) =>
    shape.type === 'circle' ? (
      <Circle r={w / 2 + outset} fill="none" {...props} />
    ) : (
      <Rect
        x={-w / 2 - outset}
        y={-h / 2 - outset}
        width={w + outset * 2}
        height={h + outset * 2}
        rx={Math.min(w, h) * 0.15 + outset}
        fill="none"
        {...props}
      />
    );

  return (
    <G
      transform={`translate(${spot.x} ${spot.y})`}
      opacity={dimmed ? 0.3 : 1}
      testID={`spot-${spot.id}`}
    >
      <G transform={spot.rotation ? `rotate(${spot.rotation})` : undefined}>
        {shape.type === 'circle' ? (
          <Circle
            r={w / 2}
            fill={fill}
            stroke={palette.spotStroke}
            strokeOpacity={SPOT_STROKE_OPACITY}
            strokeWidth={1 / k}
          />
        ) : (
          <Rect
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h}
            rx={Math.min(w, h) * 0.15}
            fill={fill}
            stroke={palette.spotStroke}
            strokeOpacity={SPOT_STROKE_OPACITY}
            strokeWidth={1 / k}
          />
        )}
        {spot.status === 'blocked' ? (
          <Line
            x1={-w * 0.35}
            y1={h * 0.35}
            x2={w * 0.35}
            y2={-h * 0.35}
            stroke={fg}
            strokeWidth={Math.max(2 / k, w * 0.06)}
            strokeLinecap="round"
          />
        ) : null}
        {matched && !selected
          ? ring(3 / k, {
              stroke: palette.spotSelected,
              strokeWidth: 2 / k,
              strokeDasharray: [4 / k, 3 / k],
            })
          : null}
        {selected ? ring(4 / k, { stroke: palette.spotSelected, strokeWidth: 3 / k }) : null}
      </G>
      {font > 0 ? (
        <SvgText y={font * 0.35} fontSize={font} fontWeight="600" fill={fg} textAnchor="middle">
          {spot.label}
        </SvgText>
      ) : null}
      {glyph && colours ? (
        <G>
          <Circle
            cx={badgeX}
            cy={badgeY}
            r={badgeR}
            fill={colours.fill}
            stroke={palette.sand}
            strokeWidth={1.5 / k}
          />
          <Path
            d={GLYPH_PATHS[glyph]}
            transform={`translate(${badgeX - badgeR * 0.8} ${badgeY - badgeR * 0.8}) scale(${(badgeR * 1.6) / 24})`}
            stroke={colours.foreground}
            strokeWidth={glyphStrokeWidth(glyph)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={glyph === 'star' ? colours.foreground : 'none'}
          />
        </G>
      ) : null}
      {showCaption && spot.caption ? (
        <SvgText
          y={h / 2 + captionFont * 1.1}
          fontSize={captionFont}
          fill={palette.spotStroke}
          textAnchor="middle"
        >
          {truncate(spot.caption, w * 1.5, captionFont)}
        </SvgText>
      ) : null}
    </G>
  );
});
