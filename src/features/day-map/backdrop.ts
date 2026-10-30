// Sand, sea band and shoreline of the day map, in the soft look of the kits
// (sabbia / mare / linea_costa): flat --beach-* tokens with a faint grain on
// the sand, a few waves on the sea and a wavy shoreline, so the illustrations
// stay the protagonists. A port of the panel's MapBackdrop
// (core web/shared/src/map/kit/MapBackdrop.tsx, pinned release): same shapes,
// sizes, opacities and tokens, except that the "Mare" label is left out when
// it would be too small to read (zoomed-out phones). The texture is two SVG patterns, so the
// backdrop is a fixed handful of elements whatever the number of spots (ADR 0008).
import type { BeachMap } from '@/api/types';

import type { MapPalette } from './palette';

type SeaSide = BeachMap['sea_side'];

/** Wavelength and amplitude of the shoreline, in map units. */
const WAVE = 96;
const AMPLITUDE = 4;

/** Side of the square tile of the grain and wave patterns, in map units (before scaling). */
export const PATTERN_TILE = 120;

/** Grain dots of the sand tile: centre x, centre y, radius. */
export const GRAIN_DOTS: readonly (readonly [number, number, number])[] = [
  [25, 38, 1.6],
  [52, 20, 0.9],
  [80, 45, 1.3],
  [36, 84, 1.1],
  [82, 86, 1.6],
  [104, 14, 0.9],
  [10, 108, 1.2],
];

/** Wave strokes of the sea tile. */
export const WAVES_PATH = 'M12 37Q26 26 40 37T68 37T96 37M72 92Q86 81 100 92T128 92';

/** Opacities and strokes of the panel's backdrop. */
export const BACKDROP = {
  grainOpacity: 0.35,
  grainScale: 1.4,
  wavesOpacity: 0.55,
  wavesScale: 0.7,
  waveStroke: 2.4,
  foamStroke: 1.2,
  foamOpacity: 0.45,
  /** Foam line distance from the shore, as a fraction of the sea depth. */
  foamOffset: 0.34,
  /** "Mare" label: size as a fraction of the sea depth, weight, tracking (em) and opacity. */
  labelSize: 0.32,
  labelWeight: '600',
  labelTracking: 0.12,
  labelOpacity: 0.55,
} as const;

/** Colours of the backdrop: --beach-* tokens of the kit art, plus --map-sea-label. */
export interface BackdropColours {
  sand: string;
  grain: string;
  sea: string;
  wave: string;
  label: string;
}

export function backdropColours(palette: MapPalette): BackdropColours {
  return {
    sand: palette.beach['sand-soft'],
    grain: palette.beach.wood,
    sea: palette.beach['water-soft'],
    wave: palette.beach.water,
    label: palette.seaLabel,
  };
}

/**
 * Wavy shoreline along an edge of `length`, in a local frame where the edge
 * runs along +x from 0 and the sea lies towards +y: `line` is the stroke,
 * `fill` closes it down to `depth` (the water reaching up into the waves).
 */
export function shorePath(
  length: number,
  depth: number,
  offset = 0,
): { fill: string; line: string } {
  const n = Math.max(1, Math.round(length / WAVE));
  const step = length / n;
  let line = `M0 ${offset}`;
  for (let i = 0; i < n; i++) {
    const x0 = i * step;
    line += ` Q${x0 + step / 4} ${offset - AMPLITUDE} ${x0 + step / 2} ${offset} T${x0 + step} ${offset}`;
  }
  return { line, fill: `${line} L${length} ${depth} L0 ${depth}Z` };
}

/** Transform from the shoreline frame of `shorePath` to map units, and the shore length. */
export function shoreFrame(
  side: SeaSide,
  width: number,
  height: number,
): { transform: string; length: number } {
  switch (side) {
    case 'bottom':
      return { transform: `translate(0 ${height})`, length: width };
    case 'top':
      return { transform: `translate(${width} 0) rotate(180)`, length: width };
    case 'left':
      return { transform: 'rotate(90)', length: height };
    case 'right':
      return { transform: `translate(${width} ${height}) rotate(-90)`, length: height };
  }
}
