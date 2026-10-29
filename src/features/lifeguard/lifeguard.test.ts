import type { LifeguardRow } from '@/api/types';

import {
  filterLifeguardRows,
  groupByRow,
  LIFEGUARD_FILTERS,
  lifeguardCounts,
  type LifeguardFilter,
} from './lifeguard';

const row = (spot: string, overrides: Partial<LifeguardRow> = {}): LifeguardRow => ({
  row_label: spot.slice(0, 1),
  spot_id: `id-${spot}`,
  spot_label: spot,
  occupant_label: 'Rossi',
  arriving: false,
  departing: false,
  balance_due: false,
  ...overrides,
});

const ROWS = [
  row('A1', { arriving: true }),
  row('A2', { departing: true, balance_due: true }),
  row('B1'),
  row('B2', { arriving: true, departing: true }),
  row('C1', { balance_due: true }),
];

describe('filterLifeguardRows', () => {
  it.each<[LifeguardFilter, string[]]>([
    ['all', ['A1', 'A2', 'B1', 'B2', 'C1']],
    ['arriving', ['A1', 'B2']],
    ['departing', ['A2', 'B2']],
    ['balance_due', ['A2', 'C1']],
  ])('%s', (filter, want) => {
    expect(filterLifeguardRows(ROWS, filter).map((r) => r.spot_label)).toEqual(want);
  });

  it.each(LIFEGUARD_FILTERS)('%s on an empty list', (filter) => {
    expect(filterLifeguardRows([], filter)).toEqual([]);
  });
});

describe('lifeguardCounts', () => {
  it.each<[string, LifeguardRow[], Record<LifeguardFilter, number>]>([
    ['every flag', ROWS, { all: 5, arriving: 2, departing: 2, balance_due: 2 }],
    ['no spot occupied', [], { all: 0, arriving: 0, departing: 0, balance_due: 0 }],
    ['one quiet spot', [row('A1')], { all: 1, arriving: 0, departing: 0, balance_due: 0 }],
  ])('%s', (_name, rows, want) => {
    expect(lifeguardCounts(rows)).toEqual(want);
  });
});

describe('groupByRow', () => {
  it.each<[string, LifeguardRow[], [string, string[]][]]>([
    [
      'rows in map order',
      ROWS,
      [
        ['A', ['A1', 'A2']],
        ['B', ['B1', 'B2']],
        ['C', ['C1']],
      ],
    ],
    [
      'a row comes back later: grouped where it first appears',
      [row('A1'), row('B1'), row('A2')],
      [
        ['A', ['A1', 'A2']],
        ['B', ['B1']],
      ],
    ],
    [
      'spots outside any row (blank labels are the same group)',
      [row('P1', { row_label: '' }), row('A1'), row('P2', { row_label: '  ' })],
      [
        ['', ['P1', 'P2']],
        ['A', ['A1']],
      ],
    ],
    ['nothing occupied', [], []],
  ])('%s', (_name, rows, want) => {
    expect(groupByRow(rows).map((g) => [g.row, g.spots.map((s) => s.spot_label)])).toEqual(want);
  });
});
