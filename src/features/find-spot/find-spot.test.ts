import type { AvailabilityResult } from '@/api/types';
import { mapDocument, mapSpot } from '@/test/map-fixtures';

import { freeCount, rowsOf, visibleRows } from './find-spot';

type SpotAvailability = NonNullable<AvailabilityResult['zones'][number]['spots']>[number];

const free = (spot_id: string, label: string): SpotAvailability => ({
  spot_id,
  label,
  status: 'available',
  free_days: 3,
  total_days: 3,
});
const taken = (spot_id: string, label: string, free_days = 0): SpotAvailability => ({
  spot_id,
  label,
  status: 'unavailable',
  free_days,
  total_days: 3,
});

const availability = (spots: SpotAvailability[]): AvailabilityResult => ({
  from: '2026-10-25',
  to: '2026-10-27',
  slots: 'FULL',
  channel: 'desk',
  zones: [
    {
      zone_id: 'z-1',
      code: 'A',
      assignment_mode: 'seat',
      capacity: spots.length,
      available: 0,
      spots,
    },
  ],
  pools: [],
});

const DOC = mapDocument({
  spots: [
    mapSpot({ id: 'a1', label: 'A1', row_label: '1', number: 1 }),
    mapSpot({ id: 'a2', label: 'A2', row_label: '1', number: 2 }),
    mapSpot({ id: 'b10', label: 'B10', row_label: '2', number: 10 }),
    mapSpot({ id: 'b2', label: 'B2', row_label: '2', number: 2 }),
    mapSpot({ id: 'c1', label: 'C1', row_label: '10', number: 1 }),
    mapSpot({ id: 'x1', label: 'X1', row_label: '', number: 1 }),
    mapSpot({ id: 'off', label: 'Z9', row_label: '1', number: 9, active: false }),
    mapSpot({ id: 'pool', label: 'P1', row_label: '1', number: 3 }),
  ],
});

describe('rowsOf', () => {
  const rows = rowsOf(
    DOC,
    availability([
      taken('a1', 'A1'),
      taken('a2', 'A2', 1),
      free('b10', 'B10'),
      free('b2', 'B2'),
      free('c1', 'C1'),
      free('x1', 'X1'),
      free('off', 'Z9'),
    ]),
  );

  it('groups by row in natural order, spots without a row last', () => {
    expect(rows.map((r) => r.row)).toEqual(['1', '2', '10', null]);
  });

  it.each([
    ['1', 0, ['A1:taken', 'A2:partly']],
    ['2', 2, ['B2:free', 'B10:free']],
    ['10', 1, ['C1:free']],
    [null, 1, ['X1:free']],
  ] as const)('row %s: %d free, spots by number with their state', (row, count, spots) => {
    const r = rows.find((x) => x.row === row)!;
    expect(r.free).toBe(count);
    expect(r.spots.map((s) => `${s.label}:${s.state}`)).toEqual(spots);
  });

  it('leaves out inactive spots and spots the availability does not list', () => {
    const ids = rows.flatMap((r) => r.spots.map((s) => s.spotId));
    expect(ids).not.toContain('off');
    expect(ids).not.toContain('pool');
  });

  it('keeps the free days of a partly free spot', () => {
    expect(rows[0]!.spots[1]).toMatchObject({ freeDays: 1, totalDays: 3 });
  });

  it('counts the free spots and hides the full rows when asked', () => {
    expect(freeCount(rows)).toBe(4);
    expect(visibleRows(rows, true).map((r) => r.row)).toEqual(['2', '10', null]);
    expect(visibleRows(rows, false)).toHaveLength(4);
  });
});
