// SVG drawing of the day map (react-native-svg): sand, sea band (MapBackdrop), and the
// decorations and spots drawn with the illustrations of the establishment's
// kit (ADR 0013), with the status colour, glyph badge and label pill.
// Drawn in map units under one transform, so panning or zooming changes a
// single attribute; spots are memoised and culled to the visible area, so a
// map of hundreds of spots stays smooth (ADR 0008).
import { memo, useMemo } from 'react';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText, Use } from 'react-native-svg';

import type { MapDocument } from '@/api/types';

import {
  cull,
  labelFontSize,
  MIN_LABEL_DP,
  quantiseScale,
  visibleRect,
  type Camera,
  type Size,
} from '../geometry';
import { GLYPH_PATHS, glyphStrokeWidth, MARKER_PATHS, STATUS_GLYPHS } from '../glyphs';
import { KitDefs, kitSymbolId, type KitSymbolRequest } from '../kit/kit-art';
import {
  badgeOffset,
  DEFAULT_MAP_KIT,
  decorationAsset,
  decorationLayout,
  kitArt,
  MAP_KIT_STYLE,
  spotArtSize,
  spotAsset,
  type MapKitKey,
} from '../kit/kits';
import { localized, type DaySpot } from '../model';
import type { MapPalette } from '../palette';
import { MapBackdrop } from './map-backdrop';

export interface MapCanvasProps {
  document: MapDocument;
  spots: readonly DaySpot[];
  camera: Camera;
  viewport: Size;
  /** Extra drawn area around the viewport, in viewports per side (pan without blanks). */
  overscan: number;
  palette: MapPalette;
  /** Illustration kit of the establishment (`theme.map_kit`). */
  kit?: MapKitKey;
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
  kit = DEFAULT_MAP_KIT,
  locale,
  seaLabel,
  selectedId,
  matches,
}: MapCanvasProps) {
  const ox = viewport.width * overscan;
  const oy = viewport.height * overscan;
  const kq = quantiseScale(camera.k);
  const rect = visibleRect(camera, viewport, overscan);
  // The art is 1.3 times the footprint and captions hang below: a margin keeps them drawn at the edges.
  const visible = useMemo(
    () => cull(spots, rect, 60),
    // The rect is recomputed every render; its numbers are what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spots, rect.x, rect.y, rect.width, rect.height],
  );
  const decorations = useMemo(
    () => cull(document.decorations, rect, 20),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [document.decorations, rect.x, rect.y, rect.width, rect.height],
  );
  const symbols = useMemo(
    () => symbolsOf(visible, decorations, kit, palette),
    [visible, decorations, kit, palette],
  );
  const art = useMemo(() => kitArt(kit), [kit]);
  const { map } = document;

  return (
    <Svg
      width={viewport.width + ox * 2}
      height={viewport.height + oy * 2}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="day-map-canvas"
    >
      <KitDefs art={art} symbols={symbols} palette={palette} />
      <G transform={`translate(${camera.tx + ox} ${camera.ty + oy}) scale(${camera.k})`}>
        <MapBackdrop map={map} palette={palette} seaLabel={seaLabel} k={kq} />
        {decorations.map((d) => (
          <DecorationNode
            key={d.id}
            x={d.x}
            y={d.y}
            rotation={d.rotation}
            shape={d.shape}
            kind={d.kind}
            asset={d.asset}
            variant={d.variant}
            label={localized(d.label, locale)}
            k={kq}
            palette={palette}
          />
        ))}
        {visible.map((s) => (
          <SpotNode
            key={s.id}
            spot={s}
            kit={kit}
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
  kind,
  asset,
  variant,
  label,
  k,
  palette,
}: {
  x: number;
  y: number;
  rotation: number;
  shape: MapDocument['decorations'][number]['shape'];
  kind: string;
  asset?: string;
  variant?: string;
  label?: string;
  k: number;
  palette: MapPalette;
}) {
  const art = decorationAsset({ kind, asset, shape });
  if (art) {
    const h = shape.type === 'circle' ? shape.w : shape.h;
    const layout = decorationLayout(art, x, y, shape);
    const href = `#${kitSymbolId({ asset: layout.asset, flag: flagColour(palette, variant) })}`;
    const font = Math.max(Math.min(shape.w, h) * 0.2, MIN_LABEL_DP / k);
    return (
      <G>
        <G transform={rotation ? `rotate(${rotation} ${x} ${y})` : undefined}>
          {layout.origins.map((o, i) => (
            <Use key={i} href={href} x={o.x} y={o.y} width={layout.side} height={layout.side} />
          ))}
        </G>
        {label ? (
          <LabelPill
            x={x}
            y={y + h / 2 + font * 0.5}
            text={truncate(label, Math.max(shape.w, h) * 1.5, font)}
            font={font}
            palette={palette}
          />
        ) : null}
      </G>
    );
  }
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

function flagColour(palette: MapPalette, variant: string | undefined): string | undefined {
  return variant && variant in palette.flags
    ? palette.flags[variant as keyof MapPalette['flags']]
    : undefined;
}

/** A spot code or a caption on a soft pill, readable over any art (panel MapLabel). */
function LabelPill({
  x,
  y,
  text,
  font,
  palette,
  bold,
  muted,
}: {
  x: number;
  y: number;
  text: string;
  font: number;
  palette: MapPalette;
  bold?: boolean;
  /** Unavailable spot: the pill fades as the panel's (opacity-60). */
  muted?: boolean;
}) {
  const w = Math.max(text.length, 1) * font * 0.62 + font * 0.9;
  const h = font * 1.32;
  return (
    <G opacity={muted ? 0.6 : 1}>
      <Rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={h / 2}
        fill={palette.labelBackground}
        fillOpacity={0.9}
        stroke={palette.labelForeground}
        strokeOpacity={0.15}
        strokeWidth={font * 0.08}
      />
      <SvgText
        x={x}
        y={y + font * 0.35}
        fontSize={font}
        fontWeight={bold ? '600' : '500'}
        fill={palette.labelForeground}
        textAnchor="middle"
      >
        {text}
      </SvgText>
    </G>
  );
}

/** Shortens `text` to what fits in `width` map units at `font` (average glyph ≈ 0.55 em). */
export function truncate(text: string, width: number, font: number): string {
  const max = Math.max(1, Math.floor(width / (font * 0.55)));
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`;
}

/**
 * Symbol of the art of a spot: the modern kit paints the status on the art
 * (one symbol per status colour), the classic kit draws it in a halo (one
 * symbol per asset).
 */
function spotSymbol(spot: DaySpot, kit: MapKitKey, palette: MapPalette): KitSymbolRequest | null {
  const asset = spotAsset(spot);
  if (!asset) return null;
  if (MAP_KIT_STYLE[kit] === 'halo') return { asset };
  return { asset, state: spot.status ? palette.status[spot.status].fill : palette.unknown };
}

/** Every symbol the visible spots and decorations draw, deduplicated. */
function symbolsOf(
  spots: readonly DaySpot[],
  decorations: MapDocument['decorations'],
  kit: MapKitKey,
  palette: MapPalette,
): KitSymbolRequest[] {
  const out = new Map<string, KitSymbolRequest>();
  const add = (s: KitSymbolRequest | null) => {
    if (s) out.set(kitSymbolId(s), s);
  };
  for (const s of spots) add(spotSymbol(s, kit, palette));
  for (const d of decorations) {
    const a = decorationAsset(d);
    if (!a) continue;
    add({
      asset: decorationLayout(a, d.x, d.y, d.shape).asset,
      flag: flagColour(palette, d.variant),
    });
  }
  return [...out.values()].sort((a, b) => kitSymbolId(a).localeCompare(kitSymbolId(b)));
}

const SpotNode = memo(function SpotNode({
  spot,
  kit,
  k,
  palette,
  selected,
  matched,
  dimmed,
}: {
  spot: DaySpot;
  kit: MapKitKey;
  k: number;
  palette: MapPalette;
  selected: boolean;
  matched: boolean;
  dimmed: boolean;
}) {
  const { shape } = spot;
  const S = spotArtSize(shape);
  const circle = shape.type === 'circle';
  const colours = spot.status ? palette.status[spot.status] : null;
  const halo = MAP_KIT_STYLE[kit] === 'halo';
  const symbol = spotSymbol(spot, kit, palette);
  const glyph = spot.status ? STATUS_GLYPHS[spot.status] : null;
  const corner = S * badgeOffset(kit);
  const badgeR = Math.min(Math.max(S * 0.12, 6.5 / k), S * 0.2);
  const font = labelFontSize(S, 0.2, k, 0.42);
  const labelY = S * 0.36;
  const captionFont = (MIN_LABEL_DP * 1.1) / k;
  const showCaption = !!spot.caption && captionFont <= S * 0.3;
  const rotate = spot.rotation ? `rotate(${spot.rotation})` : undefined;
  const square = (side: number, props: object) =>
    circle ? (
      <Circle r={side / 2} {...props} />
    ) : (
      <Rect x={-side / 2} y={-side / 2} width={side} height={side} rx={side * 0.22} {...props} />
    );
  const free = spot.status === 'free';

  return (
    <G
      transform={`translate(${spot.x} ${spot.y})`}
      opacity={dimmed ? 0.3 : 1}
      testID={`spot-${spot.id}`}
    >
      {halo && colours
        ? square(S * 1.08, {
            fill: colours.fill,
            fillOpacity: free && !selected ? 0.16 : 0.42,
            stroke: colours.fill,
            strokeWidth: free ? 0 : S * 0.035,
            strokeDasharray: spot.status === 'unavailable' ? [S * 0.06, S * 0.05] : undefined,
          })
        : null}
      <G transform={rotate} opacity={spot.status === 'unavailable' ? 0.4 : 1}>
        {symbol ? (
          <Use href={`#${kitSymbolId(symbol)}`} x={-S / 2} y={-S / 2} width={S} height={S} />
        ) : circle ? (
          <Circle
            r={shape.w * 0.42}
            fill={halo ? palette.beach.canvas : (colours?.fill ?? palette.unknown)}
            stroke={palette.beach.ink}
            strokeWidth={shape.w * 0.05}
          />
        ) : (
          <Rect
            x={-shape.w / 2}
            y={-shape.h / 2}
            width={shape.w}
            height={shape.h}
            rx={Math.min(shape.w, shape.h) * 0.18}
            fill={halo ? palette.beach.canvas : (colours?.fill ?? palette.unknown)}
            stroke={palette.beach.ink}
            strokeWidth={Math.min(shape.w, shape.h) * 0.05}
          />
        )}
      </G>
      {spot.status === 'blocked' ? (
        <G>
          <Line
            x1={-S * 0.3}
            y1={-S * 0.3}
            x2={S * 0.3}
            y2={S * 0.3}
            stroke={palette.labelBackground}
            strokeWidth={S * 0.13}
            strokeLinecap="round"
          />
          <Line
            x1={-S * 0.3}
            y1={-S * 0.3}
            x2={S * 0.3}
            y2={S * 0.3}
            stroke={palette.labelForeground}
            strokeWidth={S * 0.06}
            strokeLinecap="round"
          />
        </G>
      ) : null}
      {matched && !selected
        ? square(S * 0.94, {
            fill: 'none',
            stroke: palette.spotSelected,
            strokeWidth: 2 / k,
            strokeDasharray: [4 / k, 3 / k],
          })
        : null}
      {selected
        ? square(S * 0.94, { fill: 'none', stroke: palette.spotSelected, strokeWidth: 3 / k })
        : null}
      {glyph && colours ? (
        <G>
          <Circle
            cx={corner}
            cy={-corner}
            r={badgeR}
            fill={colours.fill}
            stroke={palette.labelBackground}
            strokeWidth={badgeR * 0.28}
          />
          <Path
            d={GLYPH_PATHS[glyph]}
            transform={`translate(${corner - badgeR * 0.72} ${-corner - badgeR * 0.72}) scale(${(badgeR * 1.44) / 24})`}
            stroke={colours.foreground}
            strokeWidth={glyphStrokeWidth(glyph)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={glyph === 'star' ? colours.foreground : 'none'}
          />
        </G>
      ) : null}
      {spot.markers.map((m, i) => {
        // Arrival and departure (spec 30.4) in the top-left corner, opposite the status badge.
        const cx = -corner + i * badgeR * 2.2;
        const c = palette.marker[m];
        return (
          <G key={m}>
            <Circle
              cx={cx}
              cy={-corner}
              r={badgeR}
              fill={c.fill}
              stroke={palette.labelBackground}
              strokeWidth={badgeR * 0.28}
            />
            <Path
              d={MARKER_PATHS[m]}
              transform={`translate(${cx - badgeR * 0.72} ${-corner - badgeR * 0.72}) scale(${(badgeR * 1.44) / 24})`}
              stroke={c.foreground}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </G>
        );
      })}
      {font > 0 ? (
        <LabelPill
          x={0}
          y={labelY}
          text={spot.label}
          font={font}
          palette={palette}
          bold
          muted={spot.status === 'unavailable'}
        />
      ) : null}
      {showCaption && spot.caption ? (
        <LabelPill
          x={0}
          y={labelY + Math.max(font, captionFont) * 1.5}
          text={truncate(spot.caption, S * 1.5, captionFont)}
          font={captionFont}
          palette={palette}
        />
      ) : null}
    </G>
  );
});
