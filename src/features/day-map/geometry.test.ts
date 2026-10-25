import {
  boundCamera,
  centerOn,
  commitLive,
  contentRect,
  cull,
  fitCamera,
  hitTest,
  labelFontSize,
  MIN_TARGET_DP,
  quantiseScale,
  scaleLimits,
  screenToMap,
  seaDepth,
  seaRect,
  visibleRect,
  zoomAt,
  type Camera,
  type PlacedShape,
} from './geometry';

const MAP = { width: 1000, height: 600 };

describe('sea band (panel rules)', () => {
  it('is 12% of the short side, at least 24 units', () => {
    expect(seaDepth(MAP)).toBe(72);
    expect(seaDepth({ width: 100, height: 100 })).toBe(24);
  });

  it.each([
    ['top', { x: 0, y: -72, width: 1000, height: 72 }],
    ['bottom', { x: 0, y: 600, width: 1000, height: 72 }],
    ['left', { x: -72, y: 0, width: 72, height: 600 }],
    ['right', { x: 1000, y: 0, width: 72, height: 600 }],
  ] as const)('sits on the %s side', (side, rect) => {
    expect(seaRect({ ...MAP, sea_side: side })).toEqual(rect);
  });

  it('is part of the content to fit', () => {
    expect(contentRect({ ...MAP, sea_side: 'top' })).toEqual({
      x: 0,
      y: -72,
      width: 1000,
      height: 672,
    });
    expect(contentRect({ ...MAP, sea_side: 'right' })).toEqual({
      x: 0,
      y: 0,
      width: 1072,
      height: 600,
    });
  });
});

describe('camera', () => {
  const viewport = { width: 400, height: 300 };
  const content = { x: 0, y: 0, width: 1000, height: 600 };

  it('fits the whole content, centred', () => {
    const cam = fitCamera(content, viewport, 0);
    expect(cam.k).toBeCloseTo(0.4);
    // 600 * 0.4 = 240 tall in a 300 viewport: 30 dp above and below.
    expect(cam.tx).toBeCloseTo(0);
    expect(cam.ty).toBeCloseTo(30);
  });

  it('zooms around the focal point, which stays still on screen', () => {
    const cam = fitCamera(content, viewport, 0);
    const limits = scaleLimits(cam);
    const focal = { x: 100, y: 120 };
    const before = screenToMap(cam, focal);
    const next = zoomAt(cam, focal, 2, limits);
    expect(next.k).toBeCloseTo(0.8);
    const after = screenToMap(next, focal);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('keeps the zoom between 0.75 and 12 times the fit', () => {
    const cam = fitCamera(content, viewport, 0);
    const limits = scaleLimits(cam);
    expect(zoomAt(cam, { x: 0, y: 0 }, 100, limits).k).toBeCloseTo(cam.k * 12);
    expect(zoomAt(cam, { x: 0, y: 0 }, 0.01, limits).k).toBeCloseTo(cam.k * 0.75);
  });

  it('commits a gesture: the live transform composed on the camera', () => {
    const cam: Camera = { k: 1, tx: 10, ty: 20 };
    const limits = { min: 0.5, max: 4 };
    expect(commitLive(cam, { s: 2, ox: 5, oy: -5 }, limits, viewport)).toEqual({
      k: 2,
      tx: 25,
      ty: 35,
    });
    // Beyond the limits the scale is clamped around the viewport centre.
    expect(commitLive(cam, { s: 10, ox: 0, oy: 0 }, limits, viewport).k).toBe(4);
  });

  it('never lets the content leave the screen', () => {
    const lost: Camera = { k: 0.4, tx: -5000, ty: 4000 };
    const kept = boundCamera(lost, content, viewport);
    const right = (content.x + content.width) * kept.k + kept.tx;
    const top = content.y * kept.k + kept.ty;
    expect(right).toBeCloseTo(80);
    expect(top).toBeCloseTo(300 - 80);
    const fine = fitCamera(content, viewport);
    expect(boundCamera(fine, content, viewport)).toEqual(fine);
  });

  it('converts screen points to map units and back through the visible rect', () => {
    const cam: Camera = { k: 2, tx: -100, ty: 50 };
    expect(screenToMap(cam, { x: 100, y: 250 })).toEqual({ x: 100, y: 100 });
    expect(visibleRect(cam, viewport)).toEqual({ x: 50, y: -25, width: 200, height: 150 });
    expect(visibleRect(cam, viewport, 0.5)).toEqual({ x: -50, y: -100, width: 400, height: 300 });
  });

  it('centres on a spot, zooming in when asked', () => {
    const cam: Camera = { k: 0.4, tx: 0, ty: 0 };
    const next = centerOn(cam, { x: 500, y: 300 }, viewport, { min: 0.3, max: 4 }, 1.5);
    expect(next).toEqual({ k: 1.5, tx: 200 - 750, ty: 150 - 450 });
  });
});

describe('hit testing and culling', () => {
  const umbrella = (x: number, y: number, extra: Partial<PlacedShape> = {}) => ({
    id: `${x},${y}`,
    x,
    y,
    rotation: 0,
    shape: { type: 'circle' as const, w: 40, h: 40 },
    ...extra,
  });
  const spots = [
    umbrella(100, 100),
    umbrella(160, 100),
    {
      id: 'cabana',
      x: 400,
      y: 100,
      rotation: 90,
      shape: { type: 'rect' as const, w: 100, h: 20 },
    },
  ];

  it('finds the spot under the finger at a readable zoom', () => {
    expect(hitTest(spots, { x: 110, y: 95 }, 2)?.id).toBe('100,100');
    expect(hitTest(spots, { x: 160, y: 118 }, 2)?.id).toBe('160,100');
    expect(hitTest(spots, { x: 130, y: 160 }, 2)).toBeUndefined();
  });

  it('undoes the rotation of the shape', () => {
    // 100×20 rotated by 90°: tall and narrow.
    expect(hitTest(spots, { x: 400, y: 145 }, 4)?.id).toBe('cabana');
    expect(hitTest(spots, { x: 445, y: 100 }, 4)).toBeUndefined();
  });

  it('keeps a 44 dp target on a zoomed-out map, nearest centre first', () => {
    const k = 0.25; // a 40-unit umbrella is 10 dp: the target grows to 176 units.
    expect(MIN_TARGET_DP / 2 / k).toBe(88);
    expect(hitTest(spots, { x: 100, y: 170 }, k)?.id).toBe('100,100');
    expect(hitTest(spots, { x: 140, y: 100 }, k)?.id).toBe('160,100');
  });

  it('draws only what meets the visible rect', () => {
    const rect = { x: 0, y: 0, width: 150, height: 150 };
    expect(cull(spots, rect).map((s) => s.id)).toEqual(['100,100', '160,100']);
    expect(cull(spots, { x: 300, y: 0, width: 50, height: 50 }, 0).map((s) => s.id)).toEqual([
      'cabana',
    ]);
    expect(cull(spots, { x: 1000, y: 1000, width: 10, height: 10 })).toEqual([]);
  });
});

describe('labels', () => {
  it('raises small labels to 9 dp and hides those that do not fit', () => {
    expect(labelFontSize(40, 0.3, 4)).toBe(12);
    expect(labelFontSize(40, 0.3, 0.5)).toBe(18);
    expect(labelFontSize(40, 0.3, 0.25)).toBe(0);
  });

  it('quantises the scale to steps of a quarter power of two', () => {
    expect(quantiseScale(1)).toBe(1);
    expect(quantiseScale(1.05)).toBe(1);
    expect(quantiseScale(1.15)).toBeCloseTo(2 ** 0.25);
    expect(quantiseScale(0)).toBe(1);
    expect(quantiseScale(Number.NaN)).toBe(1);
  });
});
