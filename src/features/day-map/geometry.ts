// Geometry of the day map: the sea band (same rules as the panel's
// web/shared/src/map/geometry.ts), the camera (pan and zoom), culling and
// hit testing. Pure functions: the viewport component keeps the camera in
// state and the gesture worklets only add a temporary transform on top.
//
// Coordinates: map units are the logical units of the map document (spot
// x/y are the centre of the shape, rotation in degrees around it); screen
// points are dp inside the viewport. The camera maps one onto the other:
// screen = map * k + t.
import type { BeachMap } from '@/api/types';

type SeaSide = BeachMap['sea_side'];

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

/** screen = map * k + (tx, ty); k is dp per map unit. */
export interface Camera {
  k: number;
  tx: number;
  ty: number;
}

/** Temporary transform of a running gesture, applied on top of the camera: p' = p * s + o. */
export interface LiveTransform {
  s: number;
  ox: number;
  oy: number;
}

export interface ScaleLimits {
  min: number;
  max: number;
}

export interface SpotShape {
  type: 'circle' | 'rect';
  /** Width in map units (diameter for circles). */
  w: number;
  /** Height in map units (ignored for circles). */
  h: number;
}

/** What hit testing and culling need of a spot. */
export interface PlacedShape {
  x: number;
  y: number;
  rotation: number;
  shape: SpotShape;
}

/** Smallest touch target, in dp (spec: at least 44 pt). */
export const MIN_TARGET_DP = 44;
/** Smallest readable label on screen, in dp (as the panel's MIN_LABEL_PX). */
export const MIN_LABEL_DP = 9;
/** Zoom range relative to the scale that fits the whole map. */
export const MIN_ZOOM = 0.75;
export const MAX_ZOOM = 12;

/** Thickness of the sea band drawn outside the sand area (panel rule). */
export function seaDepth(map: Size): number {
  return Math.max(24, Math.round(Math.min(map.width, map.height) * 0.12));
}

/** Rectangle of the sea band in map coordinates. */
export function seaRect(map: Size & { sea_side: SeaSide }): Rect {
  const depth = seaDepth(map);
  const { width, height } = map;
  switch (map.sea_side) {
    case 'top':
      return { x: 0, y: -depth, width, height: depth };
    case 'bottom':
      return { x: 0, y: height, width, height: depth };
    case 'left':
      return { x: -depth, y: 0, width: depth, height };
    case 'right':
      return { x: width, y: 0, width: depth, height };
  }
}

/** Everything that is drawn: the sand plus the sea band. */
export function contentRect(map: Size & { sea_side: SeaSide }): Rect {
  const sea = seaRect(map);
  const x = Math.min(0, sea.x);
  const y = Math.min(0, sea.y);
  return {
    x,
    y,
    width: Math.max(map.width, sea.x + sea.width) - x,
    height: Math.max(map.height, sea.y + sea.height) - y,
  };
}

/** Camera that shows the whole content, centred, with `padding` dp around it. */
export function fitCamera(content: Rect, viewport: Size, padding = 12): Camera {
  const w = Math.max(1, viewport.width - padding * 2);
  const h = Math.max(1, viewport.height - padding * 2);
  const k = Math.max(
    1e-6,
    Math.min(w / Math.max(1, content.width), h / Math.max(1, content.height)),
  );
  return {
    k,
    tx: viewport.width / 2 - (content.x + content.width / 2) * k,
    ty: viewport.height / 2 - (content.y + content.height / 2) * k,
  };
}

export function scaleLimits(fit: Camera): ScaleLimits {
  return { min: fit.k * MIN_ZOOM, max: fit.k * MAX_ZOOM };
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Zooms by `factor` keeping the screen point `focal` fixed, within the limits. */
export function zoomAt(cam: Camera, focal: Point, factor: number, limits: ScaleLimits): Camera {
  const k = clamp(cam.k * factor, limits.min, limits.max);
  const r = k / cam.k;
  return { k, tx: focal.x - (focal.x - cam.tx) * r, ty: focal.y - (focal.y - cam.ty) * r };
}

/** The camera after a gesture: the live transform applied on top of it, scale kept in the limits. */
export function commitLive(
  cam: Camera,
  live: LiveTransform,
  limits: ScaleLimits,
  viewport: Size,
): Camera {
  const next = { k: cam.k * live.s, tx: cam.tx * live.s + live.ox, ty: cam.ty * live.s + live.oy };
  if (next.k >= limits.min && next.k <= limits.max) return next;
  return zoomAt(next, { x: viewport.width / 2, y: viewport.height / 2 }, 1, limits);
}

/**
 * Keeps part of the content on screen: at least `margin` dp of it stays
 * inside the viewport on each axis, so the map can never be lost off screen.
 */
export function boundCamera(cam: Camera, content: Rect, viewport: Size): Camera {
  const mx = Math.min(80, viewport.width / 3);
  const my = Math.min(80, viewport.height / 3);
  let { tx, ty } = cam;
  const x0 = content.x * cam.k + tx;
  const x1 = (content.x + content.width) * cam.k + tx;
  if (x1 < mx) tx += mx - x1;
  else if (x0 > viewport.width - mx) tx -= x0 - (viewport.width - mx);
  const y0 = content.y * cam.k + ty;
  const y1 = (content.y + content.height) * cam.k + ty;
  if (y1 < my) ty += my - y1;
  else if (y0 > viewport.height - my) ty -= y0 - (viewport.height - my);
  return { k: cam.k, tx, ty };
}

export function screenToMap(cam: Camera, p: Point): Point {
  return { x: (p.x - cam.tx) / cam.k, y: (p.y - cam.ty) / cam.k };
}

/** Map rectangle seen through the viewport, enlarged by `overscan` viewports on each side. */
export function visibleRect(cam: Camera, viewport: Size, overscan = 0): Rect {
  const ox = viewport.width * overscan;
  const oy = viewport.height * overscan;
  const a = screenToMap(cam, { x: -ox, y: -oy });
  return {
    x: a.x,
    y: a.y,
    width: (viewport.width + ox * 2) / cam.k,
    height: (viewport.height + oy * 2) / cam.k,
  };
}

/** Centres the viewport on `point` (map units), zooming in to at least `minK`. */
export function centerOn(
  cam: Camera,
  point: Point,
  viewport: Size,
  limits: ScaleLimits,
  minK = cam.k,
): Camera {
  const k = clamp(Math.max(cam.k, minK), limits.min, limits.max);
  return { k, tx: viewport.width / 2 - point.x * k, ty: viewport.height / 2 - point.y * k };
}

/** Radius of the circle that contains the shape (culling). */
export function boundingRadius(shape: SpotShape): number {
  return shape.type === 'circle' ? shape.w / 2 : Math.hypot(shape.w, shape.h) / 2;
}

/** The items whose shape (plus `margin` map units for labels) meets `rect`. */
export function cull<T extends PlacedShape>(items: readonly T[], rect: Rect, margin = 0): T[] {
  const x1 = rect.x + rect.width;
  const y1 = rect.y + rect.height;
  return items.filter((it) => {
    const r = boundingRadius(it.shape) + margin;
    return it.x + r >= rect.x && it.x - r <= x1 && it.y + r >= rect.y && it.y - r <= y1;
  });
}

/** `p` in the frame of the shape: origin at its centre, rotation undone. */
function toLocal(it: PlacedShape, p: Point): Point {
  const dx = p.x - it.x;
  const dy = p.y - it.y;
  if (!it.rotation) return { x: dx, y: dy };
  const a = (-it.rotation * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/**
 * The item under the map point `p`, or undefined. Every shape is hit as if
 * it were at least MIN_TARGET_DP on screen at scale `k` (small umbrellas on a
 * zoomed-out map stay tappable); where enlarged targets overlap, the item
 * whose centre is nearest wins.
 */
export function hitTest<T extends PlacedShape>(
  items: readonly T[],
  p: Point,
  k: number,
): T | undefined {
  const half = MIN_TARGET_DP / 2 / k;
  let best: T | undefined;
  let bestDist = Infinity;
  for (const it of items) {
    const l = toLocal(it, p);
    let hit: boolean;
    if (it.shape.type === 'circle') {
      const r = Math.max(it.shape.w / 2, half);
      hit = l.x * l.x + l.y * l.y <= r * r;
    } else {
      hit =
        Math.abs(l.x) <= Math.max(it.shape.w / 2, half) &&
        Math.abs(l.y) <= Math.max(it.shape.h / 2, half);
    }
    if (!hit) continue;
    const d = Math.hypot(l.x, l.y);
    if (d < bestDist) {
      best = it;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Font size (map units) of a label inside a shape of `size` map units: the
 * proportional size, raised to MIN_LABEL_DP on screen; 0 when even that
 * would not fit (the label stays in the accessible name and the sheet).
 */
export function labelFontSize(size: number, ratio: number, k: number, maxRatio = 0.8): number {
  const wanted = Math.max(size * ratio, MIN_LABEL_DP / k);
  return wanted > size * maxRatio ? 0 : wanted;
}

/**
 * Rounds the scale to a step of about 19% (quarter powers of two): labels
 * and badges change size in visible steps only, so committing a small zoom
 * does not re-render every memoised spot (panel's quantiseUnitsPerPixel).
 */
export function quantiseScale(k: number): number {
  if (!(k > 0) || !Number.isFinite(k)) return 1;
  return 2 ** (Math.round(Math.log2(k) * 4) / 4);
}
