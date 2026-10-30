// Beach map kits of the pinned core (ADR 0013): which illustration a spot or
// a decoration is drawn with and where. Mirrors the panel's
// web/shared/src/map/kit (assets.ts, geometry.ts) of the same release.
import type { KitArt } from './art-types';
import {
  KIT_ASSETS,
  MAP_KIT_KEYS,
  MAP_KIT_STYLE,
  type KitAssetId,
  type KitAssetInfo,
  type MapKitKey,
} from './generated/manifest';

export { MAP_KIT_STYLE, type KitAssetId, type MapKitKey };

/** Kit of an establishment that has not chosen one (core: DEFAULT_MAP_KIT). */
export const DEFAULT_MAP_KIT: MapKitKey = MAP_KIT_KEYS[0];

const BY_ID: ReadonlyMap<string, KitAssetInfo> = new Map(KIT_ASSETS.map((a) => [a.id, a]));

/** The establishment's kit (`theme.map_kit`), or the default for an unknown or missing one. */
export function mapKitOf(theme: { map_kit?: string } | undefined): MapKitKey {
  const k = theme?.map_kit;
  return (MAP_KIT_KEYS as readonly string[]).includes(k ?? '') ? (k as MapKitKey) : DEFAULT_MAP_KIT;
}

/** Art of a kit, loaded on first use (each kit is a separate module). */
export function kitArt(kit: MapKitKey): KitArt {
  /* eslint-disable @typescript-eslint/no-require-imports */
  return kit === 'classic'
    ? (require('./generated/art-classic') as { KIT_ART: KitArt }).KIT_ART
    : (require('./generated/art-modern') as { KIT_ART: KitArt }).KIT_ART;
  /* eslint-enable @typescript-eslint/no-require-imports */
}

/** Illustration of a spot whose `asset` is empty, by kind (custom: none, plain shape). */
const SPOT_DEFAULTS: Readonly<Record<string, KitAssetId>> = {
  umbrella: 'ombrellone_2_lettini',
  gazebo: 'gazebo',
  tent: 'tenda_righe',
  palm: 'ombrellone_paglia',
  sunbed: 'lettino',
  daybed: 'daybed',
  cabana: 'cabana',
  hammock: 'amaca',
};

/** Illustration of a decoration whose `asset` is empty, by kind (text, custom: none). */
const DECORATION_DEFAULTS: Readonly<Record<string, KitAssetId>> = {
  walkway: 'passerella_orizzontale',
  shower: 'doccia',
  lifeguard: 'torretta_bagnino',
  bar: 'bar',
  entrance: 'ingresso',
  cabin_block: 'cabine_multiple',
};

/** The illustration a spot is drawn with, or null for a plain shape. */
export function spotAsset(spot: { kind: string; asset?: string | null }): KitAssetId | null {
  const a = spot.asset ? BY_ID.get(spot.asset) : undefined;
  if (a?.type === 'bookable') return a.id;
  return SPOT_DEFAULTS[spot.kind] ?? null;
}

/** The illustration a decoration is drawn with, or null (text, custom without asset). */
export function decorationAsset(d: {
  kind: string;
  asset?: string | null;
  shape: { w: number; h?: number };
}): KitAssetId | null {
  const a = d.asset ? BY_ID.get(d.asset) : undefined;
  if (a) return a.id;
  if (d.kind === 'walkway' && (d.shape.h ?? d.shape.w) > d.shape.w) return 'passerella_verticale';
  return DECORATION_DEFAULTS[d.kind] ?? null;
}

type Shape = { type: 'rect' | 'circle'; w: number; h?: number };

/**
 * How much larger than its footprint a spot is drawn: the art leaves a
 * transparent margin inside its viewBox (core: SPOT_ART_SCALE).
 */
export const SPOT_ART_SCALE = 1.3;

/** Side of the square the art of a spot is drawn in, map units. */
export function spotArtSize(shape: Shape): number {
  const h = shape.type === 'circle' ? shape.w : (shape.h ?? shape.w);
  return Math.max(shape.w, h) * SPOT_ART_SCALE;
}

/**
 * Centre of the status badge from the centre of the art box, as a fraction
 * of its side: the modern kit keeps the top-right corner (92-120 of 120)
 * empty for it; classic draws it over the art.
 */
export function badgeOffset(kit: MapKitKey): number {
  return MAP_KIT_STYLE[kit] === 'fill' ? 0.383 : 0.34;
}

export interface TilePlacement {
  asset: KitAssetId;
  /** Top-left corners, before the element rotation. */
  origins: { x: number; y: number }[];
  side: number;
}

/**
 * Art boxes of a decoration centred on (x, y): walkway tiles repeated along
 * the long side at the short side's scale; any other asset once, centred, in
 * the largest square that fits.
 */
export function decorationLayout(
  asset: KitAssetId,
  x: number,
  y: number,
  shape: Shape,
): TilePlacement {
  const w = shape.w;
  const h = shape.type === 'circle' ? shape.w : (shape.h ?? shape.w);
  const side = Math.min(w, h);
  if (!BY_ID.get(asset)?.tile) {
    return { asset, origins: [{ x: x - side / 2, y: y - side / 2 }], side };
  }
  const n = Math.max(1, Math.round(Math.max(w, h) / side));
  const horizontal = w >= h;
  let id = asset;
  if (n > 1 && asset === 'passerella_verticale' && horizontal) id = 'passerella_orizzontale';
  if (n > 1 && asset === 'passerella_orizzontale' && !horizontal) id = 'passerella_verticale';
  const len = n * side;
  const x0 = horizontal ? x - len / 2 : x - side / 2;
  const y0 = horizontal ? y - side / 2 : y - len / 2;
  const origins = Array.from({ length: n }, (_, i) =>
    horizontal ? { x: x0 + i * side, y: y0 } : { x: x0, y: y0 + i * side },
  );
  return { asset: id, origins, side };
}
