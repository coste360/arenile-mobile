// Fixtures of the maps (core spec 11): map documents with spots and
// decorations, and grids of many spots for the day map.
import type { BeachMap, MapDocument } from '@/api/types';

type Spot = MapDocument['spots'][number];
type Decoration = MapDocument['decorations'][number];

export function beachMap(overrides: Partial<BeachMap> = {}): BeachMap {
  return {
    id: 'm-1',
    name: { it: 'Spiaggia', en: 'Beach' },
    width: 600,
    height: 400,
    grid_size: 10,
    sea_side: 'bottom',
    sort_order: 0,
    spot_count: 3,
    version: 1,
    created_at: '2026-05-01T08:00:00Z',
    updated_at: '2026-05-01T08:00:00Z',
    ...overrides,
  };
}

export function mapSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 's-1',
    map_id: 'm-1',
    zone_id: 'z-1',
    label: 'A1',
    row_label: 'A',
    number: 1,
    kind: 'umbrella',
    x: 100,
    y: 100,
    rotation: 0,
    shape: { type: 'circle', w: 40, h: 40 },
    capacity: { umbrella: 1, sunbed: 2 },
    max_extra: {},
    attributes: [],
    active: true,
    ...overrides,
  };
}

export function decoration(overrides: Partial<Decoration> = {}): Decoration {
  return {
    id: 'd-1',
    map_id: 'm-1',
    kind: 'bar',
    x: 500,
    y: 60,
    rotation: 0,
    shape: { type: 'rect', w: 80, h: 40 },
    label: { it: 'Bar', en: 'Bar' },
    ...overrides,
  };
}

export function mapDocument(overrides: Partial<MapDocument> = {}): MapDocument {
  return {
    map: beachMap(),
    spots: [
      mapSpot(),
      mapSpot({ id: 's-2', label: 'A2', number: 2, x: 160 }),
      mapSpot({ id: 's-3', label: 'B1', row_label: 'B', x: 100, y: 180 }),
    ],
    decorations: [decoration()],
    ...overrides,
  };
}

/** A map of `rows` × `cols` umbrellas labelled A1…, 60 units apart. */
export function gridDocument(rows: number, cols: number, mapId = 'm-1'): MapDocument {
  const spots: Spot[] = [];
  for (let r = 0; r < rows; r++) {
    const row = String.fromCharCode(65 + (r % 26)) + (r >= 26 ? String(Math.floor(r / 26)) : '');
    for (let c = 0; c < cols; c++) {
      spots.push(
        mapSpot({
          id: `${mapId}-s-${r}-${c}`,
          map_id: mapId,
          label: `${row}${c + 1}`,
          row_label: row,
          number: c + 1,
          x: 40 + c * 60,
          y: 40 + r * 60,
        }),
      );
    }
  }
  return {
    map: beachMap({
      id: mapId,
      width: 40 + cols * 60,
      height: 40 + rows * 60,
      spot_count: spots.length,
    }),
    spots,
    decorations: [],
  };
}
