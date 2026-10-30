import type { AvailabilityResult } from '@/api/types';
import { mapDocument, mapSpot } from '@/test/map-fixtures';

import {
  askableStay,
  attributeOptions,
  freeCount,
  freePlaces,
  rowsOf,
  visibleRows,
  wholeStayClosed,
  zoneCards,
} from './by-row';

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

describe('wholeStayClosed', () => {
  const closedOn = (from: string, to: string, closed_dates?: string[]) => ({
    ...availability([]),
    from,
    to,
    ...(closed_dates ? { closed_dates } : {}),
  });

  it.each([
    ['no closed day', closedOn('2026-10-25', '2026-10-27'), false],
    ['some days closed', closedOn('2026-10-25', '2026-10-27', ['2026-10-26']), false],
    [
      'every day closed',
      closedOn('2026-10-25', '2026-10-27', ['2026-10-25', '2026-10-26', '2026-10-27']),
      true,
    ],
    ['a closed single day', closedOn('2026-10-26', '2026-10-26', ['2026-10-26']), true],
    [
      'closed days outside the stay do not count',
      closedOn('2026-10-25', '2026-10-26', ['2026-10-25', '2026-10-24', '2026-10-27']),
      false,
    ],
  ] as const)('%s → %s', (_, a, expected) => {
    expect(wholeStayClosed(a)).toBe(expected);
  });
});

type ZoneAvailability = AvailabilityResult['zones'][number];

const zone = (overrides: Partial<ZoneAvailability>): ZoneAvailability => ({
  zone_id: 'z-1',
  code: 'A',
  assignment_mode: 'seat',
  capacity: 0,
  available: 0,
  ...overrides,
});

describe('zones by assignment mode', () => {
  const answer: AvailabilityResult = {
    ...availability([]),
    zones: [
      zone({ zone_id: 'z-seat', spots: [free('a1', 'A1')] }),
      zone({
        zone_id: 'z-lawn',
        code: 'prato',
        assignment_mode: 'zone',
        capacity: 20,
        available: 6,
        // Spots of a zone sold as a whole are not offered one by one.
        spots: [free('b2', 'B2')],
      }),
      zone({
        zone_id: 'z-beds',
        code: 'lettini',
        assignment_mode: 'quantity',
        capacity: 40,
        available: 0,
      }),
      zone({
        zone_id: 'z-odd',
        code: 'odd',
        assignment_mode: 'quantity',
        capacity: 5,
        available: 9,
      }),
    ],
  };

  it('offers row by row only the spots of seat zones', () => {
    expect(rowsOf(DOC, answer).flatMap((r) => r.spots.map((s) => s.label))).toEqual(['A1']);
  });

  // z-lawn and z-odd known to the zones list, z-beds not (yet).
  const known = new Map([
    ['z-lawn', { name: 'Prato', mapId: 'm-1' }],
    ['z-odd', { name: '' }],
    ['z-empty', { name: 'Vuota' }],
  ]);
  const withEmpty = [
    ...answer.zones,
    zone({ zone_id: 'z-empty', code: 'vuota', assignment_mode: 'zone', capacity: 0, available: 0 }),
  ];

  it.each([
    ['z-lawn', 'Prato', 'zone', 20, 6],
    // Name missing in the list: the code; more free than capacity: clamped.
    ['z-odd', 'odd', 'quantity', 5, 5],
  ] as const)('%s: %s (%s), %d places, %d free', (zoneId, name, mode, capacity, available) => {
    expect(zoneCards(withEmpty, known).find((c) => c.zoneId === zoneId)).toEqual({
      zoneId,
      name,
      mode,
      capacity,
      available,
    });
  });

  it.each([
    ['a seat zone', 'z-seat'],
    ['a zone the zones list does not know', 'z-beds'],
    ['a zone without places', 'z-empty'],
  ])('leaves out %s', (_, zoneId) => {
    expect(zoneCards(withEmpty, known).map((c) => c.zoneId)).not.toContain(zoneId);
  });

  it('shows no card while the zones list is unknown', () => {
    expect(zoneCards(withEmpty, new Map())).toEqual([]);
  });

  it('adds up the free places of the cards', () => {
    expect(freePlaces(zoneCards(withEmpty, known))).toBe(11);
  });
});

describe('attributes', () => {
  const doc = mapDocument({
    spots: [
      mapSpot({
        id: 'a1',
        label: 'A1',
        row_label: '1',
        number: 1,
        attributes: ['Prima fila', 'ombra'],
      }),
      mapSpot({ id: 'a2', label: 'A2', row_label: '1', number: 2, attributes: ['prima fila'] }),
      mapSpot({
        id: 'b1',
        label: 'B1',
        row_label: '2',
        number: 1,
        attributes: ['Ombra', 'vicino al bar'],
      }),
      mapSpot({ id: 'b2', label: 'B2', row_label: '2', number: 2, attributes: [] }),
      mapSpot({
        id: 'off',
        label: 'Z9',
        row_label: '2',
        number: 9,
        active: false,
        attributes: ['spenta'],
      }),
    ],
  });
  const answer = availability([
    free('a1', 'A1'),
    taken('a2', 'A2'),
    free('b1', 'B1'),
    free('b2', 'B2'),
  ]);

  it.each<[string, AvailabilityResult, string[]]>([
    [
      'the offered spots, once each, as written, sorted',
      answer,
      ['ombra', 'Prima fila', 'vicino al bar'],
    ],
    // B1 is not in a seat zone of the answer (sold as a zone): its attributes do not filter anything.
    [
      'only the spots offered row by row',
      {
        ...answer,
        zones: [
          zone({ zone_id: 'z-1', spots: [free('a1', 'A1'), taken('a2', 'A2'), free('b2', 'B2')] }),
          zone({ zone_id: 'z-2', assignment_mode: 'zone', capacity: 1, spots: [free('b1', 'B1')] }),
        ],
      },
      ['ombra', 'Prima fila'],
    ],
    ['no spot of the answer', availability([]), []],
  ])('attribute options: %s', (_, a, expected) => {
    expect(attributeOptions(doc, a)).toEqual(expected);
  });

  it('has no options when no spot has attributes', () => {
    expect(attributeOptions(DOC, availability([free('a1', 'A1')]))).toEqual([]);
  });

  it.each([
    ['nothing selected', [], { '1': ['A1', 'A2'], '2': ['B1', 'B2'] }, 3],
    ['one attribute, any case', ['PRIMA FILA'], { '1': ['A1', 'A2'] }, 1],
    ['two attributes together (AND)', ['prima fila', 'Ombra'], { '1': ['A1'] }, 1],
    ['an attribute of another row', ['vicino al bar'], { '2': ['B1'] }, 1],
    ['no spot has them all', ['vicino al bar', 'prima fila'], {}, 0],
  ] as const)('%s', (_, attributes, expected, free) => {
    const rows = rowsOf(doc, answer, { attributes });
    expect(Object.fromEntries(rows.map((r) => [r.row, r.spots.map((s) => s.label)]))).toEqual(
      expected,
    );
    expect(freeCount(rows)).toBe(free);
  });
});

describe('askableStay', () => {
  it.each([
    ['one day', '2026-10-25', '2026-10-25', true],
    ['199 days', '2026-10-25', '2027-05-11', true],
    ['200 days (the core refuses)', '2026-10-25', '2027-05-12', false],
    ['the last day before the first', '2026-10-25', '2026-10-24', false],
  ] as const)('%s → %s', (_, from, to, expected) => {
    expect(askableStay(from, to)).toBe(expected);
  });
});
