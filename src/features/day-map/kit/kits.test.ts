import { MAP_PALETTE, type BeachToken } from '../palette';
import type { KitNode } from './art-types';
import { KIT_ASSET_IDS, MAP_KIT_KEYS } from './generated/manifest';
import {
  badgeOffset,
  decorationAsset,
  decorationLayout,
  kitArt,
  mapKitOf,
  spotArtSize,
  spotAsset,
} from './kits';

describe('mapKitOf', () => {
  it.each([
    [undefined, 'modern'],
    [{}, 'modern'],
    [{ map_kit: 'classic' }, 'classic'],
    [{ map_kit: 'modern' }, 'modern'],
    [{ map_kit: 'future' }, 'modern'],
  ])('%j → %s', (theme, kit) => {
    expect(mapKitOf(theme)).toBe(kit);
  });
});

describe('spotAsset', () => {
  it.each([
    [{ kind: 'umbrella' }, 'ombrellone_2_lettini'],
    [{ kind: 'umbrella', asset: 'ombrellone_4_lettini' }, 'ombrellone_4_lettini'],
    // Only bookable art for a spot; an unknown id falls back to the kind.
    [{ kind: 'umbrella', asset: 'bar' }, 'ombrellone_2_lettini'],
    [{ kind: 'gazebo', asset: 'nope' }, 'gazebo'],
    [{ kind: 'palm' }, 'ombrellone_paglia'],
    [{ kind: 'custom' }, null],
  ])('%j → %s', (spot, asset) => {
    expect(spotAsset(spot)).toBe(asset);
  });
});

describe('decorationAsset', () => {
  it.each([
    [{ kind: 'bar', shape: { w: 40, h: 40 } }, 'bar'],
    [{ kind: 'custom', asset: 'bandiera_mare', shape: { w: 20, h: 20 } }, 'bandiera_mare'],
    [{ kind: 'walkway', shape: { w: 200, h: 20 } }, 'passerella_orizzontale'],
    [{ kind: 'walkway', shape: { w: 20, h: 200 } }, 'passerella_verticale'],
    [{ kind: 'text', shape: { w: 80, h: 20 } }, null],
  ])('%j → %s', (d, asset) => {
    expect(decorationAsset(d)).toBe(asset);
  });
});

describe('layout', () => {
  it('draws a spot 1.3 times its longest side', () => {
    expect(spotArtSize({ type: 'rect', w: 40, h: 30 })).toBeCloseTo(52);
    expect(spotArtSize({ type: 'circle', w: 20 })).toBeCloseTo(26);
  });

  it('puts the badge in the corner the modern kit keeps free', () => {
    expect(badgeOffset('modern')).toBeCloseTo(0.383);
    expect(badgeOffset('classic')).toBeCloseTo(0.34);
  });

  it('repeats walkway tiles along the long side', () => {
    const t = decorationLayout('passerella_orizzontale', 100, 50, { type: 'rect', w: 120, h: 40 });
    expect(t).toEqual({
      asset: 'passerella_orizzontale',
      side: 40,
      origins: [
        { x: 40, y: 30 },
        { x: 80, y: 30 },
        { x: 120, y: 30 },
      ],
    });
  });

  it('turns a straight walkway to follow the long side', () => {
    const t = decorationLayout('passerella_orizzontale', 0, 0, { type: 'rect', w: 20, h: 60 });
    expect(t.asset).toBe('passerella_verticale');
    expect(t.origins).toHaveLength(3);
  });

  it('draws any other asset once in the largest square that fits', () => {
    expect(decorationLayout('bar', 50, 50, { type: 'rect', w: 80, h: 40 })).toEqual({
      asset: 'bar',
      side: 40,
      origins: [{ x: 30, y: 30 }],
    });
  });
});

describe('generated art', () => {
  const tokens = new Set([...Object.keys(MAP_PALETTE.light.beach), 'state', 'flag']);

  function colours(nodes: readonly KitNode[], out: Set<string>) {
    for (const [, props, children] of nodes) {
      for (const v of [props.fill, props.stroke]) if (typeof v === 'string') out.add(v);
      if (typeof children !== 'string') colours(children, out);
    }
    return out;
  }

  it.each(MAP_KIT_KEYS)('%s has art for every asset, coloured only by palette tokens', (kit) => {
    const art = kitArt(kit);
    expect(Object.keys(art).sort()).toEqual([...KIT_ASSET_IDS].sort());
    const used = new Set<string>();
    for (const id of KIT_ASSET_IDS) colours(art[id]!, used);
    for (const c of used) {
      if (c === 'none') continue;
      expect(c.startsWith('$') && tokens.has(c.slice(1))).toBe(true);
    }
  });

  it('dark and light palettes define the same kit tokens', () => {
    expect(Object.keys(MAP_PALETTE.dark.beach).sort()).toEqual(
      (Object.keys(MAP_PALETTE.light.beach) as BeachToken[]).sort(),
    );
  });
});
