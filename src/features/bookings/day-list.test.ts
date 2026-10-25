import type { BookingSummary } from '@/api/types';
import { bookingSummary } from '@/test/operations-fixtures';

import {
  dayBookingFigures,
  DEFAULT_DAY_LIST_QUERY,
  isChannelFilter,
  isDayFilter,
  isDaySort,
  matchesChannel,
  matchesFilter,
  matchesSearch,
  normalizeSearch,
  selectBookings,
  sortBookings,
  type DayFilter,
} from './day-list';

const DAY = '2026-10-25';

describe('matchesFilter', () => {
  it.each<[string, Partial<BookingSummary>, DayFilter, boolean]>([
    ['everything is in "all"', { status: 'cancelled' }, 'all', true],
    ['arrival starting today', { starts_on: DAY }, 'arrivals', true],
    [
      'checked in today is still an arrival',
      { starts_on: DAY, status: 'checked_in' },
      'arrivals',
      true,
    ],
    ['started yesterday is no arrival', { starts_on: '2026-10-24' }, 'arrivals', false],
    ['season pass is no arrival', { starts_on: DAY, is_season_pass: true }, 'arrivals', false],
    ['cancelled is no arrival', { starts_on: DAY, status: 'cancelled' }, 'arrivals', false],
    [
      'awaiting payment counts (active)',
      { starts_on: DAY, status: 'pending_payment' },
      'arrivals',
      true,
    ],
    ['checked in is present', { status: 'checked_in' }, 'present', true],
    ['confirmed is not present', { status: 'confirmed' }, 'present', false],
    ['balance due to settle', { balance_due: 1 }, 'to_settle', true],
    ['paid is settled', { balance_due: 0 }, 'to_settle', false],
    [
      'no-show with balance is not to settle',
      { status: 'no_show', balance_due: 500 },
      'to_settle',
      false,
    ],
    ['active season pass', { is_season_pass: true }, 'season_pass', true],
    ['ordinary booking is no pass', { is_season_pass: false }, 'season_pass', false],
    ['cancelled pass', { is_season_pass: true, status: 'cancelled' }, 'season_pass', false],
  ])('%s', (_name, overrides, filter, expected) => {
    expect(matchesFilter(bookingSummary(overrides), filter, DAY)).toBe(expected);
  });
});

describe('matchesChannel', () => {
  it.each([
    ['desk', 'all', true],
    ['online', 'all', true],
    ['desk', 'desk', true],
    ['online', 'desk', false],
    ['api', 'desk', false],
    ['online', 'online', true],
    ['api', 'online', true],
    ['desk', 'online', false],
  ] as const)('%s booking in the %s filter: %s', (channel, filter, expected) => {
    expect(matchesChannel(bookingSummary({ channel }), filter)).toBe(expected);
  });
});

describe('search', () => {
  it.each([
    ['Nicolò Bianchi', 'nicolo bianchi'],
    ['  ÀÉÎ ', 'aei'],
    ['AR-7K3Q9', 'ar-7k3q9'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeSearch(input)).toBe(expected);
  });

  const b = bookingSummary({
    code: 'AR-7K3Q9',
    customer_display_name: 'Rossi Nicolò',
    spot_labels: ['A1', 'A2'],
  });
  it.each([
    ['', true],
    ['   ', true],
    ['rossi', true],
    ['NICOLO', true],
    ['7k3q', true],
    ['a2', true],
    ['rossi a1', true],
    ['rossi b4', false],
    ['bianchi', false],
  ])('%j matches: %s', (query, expected) => {
    expect(matchesSearch(b, query)).toBe(expected);
  });
});

describe('sortBookings', () => {
  const list = [
    bookingSummary({
      id: '1',
      code: 'C',
      spot_labels: ['A10'],
      customer_display_name: 'Verdi',
      starts_on: '2026-10-20',
      balance_due: 0,
    }),
    bookingSummary({
      id: '2',
      code: 'B',
      spot_labels: [],
      customer_display_name: 'Bianchi',
      starts_on: '2026-10-25',
      balance_due: 500,
    }),
    bookingSummary({
      id: '3',
      code: 'A',
      spot_labels: ['A2'],
      customer_display_name: 'rossi',
      starts_on: '2026-10-22',
      balance_due: 2000,
    }),
    bookingSummary({
      id: '4',
      code: 'D',
      spot_labels: ['B1', 'A3'],
      customer_display_name: 'Esposito',
      starts_on: '2026-10-22',
      balance_due: 500,
    }),
  ];
  const ids = (l: BookingSummary[]) => l.map((b) => b.id);

  it.each([
    ['spot', ['3', '4', '1', '2']],
    ['customer', ['2', '4', '3', '1']],
    ['arrival', ['1', '3', '4', '2']],
    ['balance', ['3', '4', '2', '1']],
  ] as const)('by %s', (sort, expected) => {
    expect(ids(sortBookings(list, sort))).toEqual(expected);
  });

  it('does not change the input', () => {
    sortBookings(list, 'customer');
    expect(ids(list)).toEqual(['1', '2', '3', '4']);
  });
});

describe('selectBookings', () => {
  const list = [
    bookingSummary({ id: 'arr', starts_on: DAY, spot_labels: ['A1'] }),
    bookingSummary({
      id: 'in',
      starts_on: '2026-10-24',
      status: 'checked_in',
      balance_due: 0,
      spot_labels: ['A2'],
      channel: 'online',
    }),
    bookingSummary({ id: 'gone', status: 'cancelled', spot_labels: ['A3'] }),
    bookingSummary({
      id: 'pass',
      is_season_pass: true,
      starts_on: '2026-06-01',
      balance_due: 0,
      spot_labels: ['A4'],
      channel: 'api',
    }),
  ];
  const run = (q: Partial<typeof DEFAULT_DAY_LIST_QUERY>) =>
    selectBookings(list, { ...DEFAULT_DAY_LIST_QUERY, date: DAY, ...q }).map((b) => b.id);

  it.each([
    ['default hides cancelled', {}, ['arr', 'in', 'pass']],
    ['closed on request', { includeClosed: true }, ['arr', 'in', 'gone', 'pass']],
    ['arrivals', { filter: 'arrivals' }, ['arr']],
    ['present', { filter: 'present' }, ['in']],
    ['to settle', { filter: 'to_settle' }, ['arr']],
    ['season passes', { filter: 'season_pass' }, ['pass']],
    ['online includes the API', { channel: 'online' }, ['in', 'pass']],
    ['desk', { channel: 'desk' }, ['arr']],
    ['search', { search: 'a4' }, ['pass']],
    ['combined, nothing', { filter: 'present', channel: 'desk' }, []],
  ] as const)('%s', (_name, q, expected) => {
    expect(run(q)).toEqual(expected);
  });
});

describe('dayBookingFigures', () => {
  it('counts exactly what the filtered lists show', () => {
    const list = [
      bookingSummary({ id: '1', starts_on: DAY, balance_due: 2000 }),
      bookingSummary({ id: '2', starts_on: DAY, status: 'checked_in', balance_due: 0 }),
      bookingSummary({ id: '3', starts_on: '2026-10-20', status: 'checked_in', balance_due: 750 }),
      bookingSummary({ id: '4', starts_on: DAY, status: 'cancelled', balance_due: 3000 }),
      bookingSummary({ id: '5', starts_on: DAY, is_season_pass: true, balance_due: 0 }),
    ];
    const figures = dayBookingFigures(list, DAY);
    expect(figures).toEqual({ arrivals: 2, present: 2, toSettle: 2, toSettleAmount: 2750 });
    for (const [filter, count] of [
      ['arrivals', figures.arrivals],
      ['present', figures.present],
      ['to_settle', figures.toSettle],
    ] as const) {
      expect(selectBookings(list, { ...DEFAULT_DAY_LIST_QUERY, date: DAY, filter })).toHaveLength(
        count,
      );
    }
  });

  it('is zero for an empty day', () => {
    expect(dayBookingFigures([], DAY)).toEqual({
      arrivals: 0,
      present: 0,
      toSettle: 0,
      toSettleAmount: 0,
    });
  });
});

describe('guards of the route parameters', () => {
  it.each([
    [isDayFilter, 'arrivals', true],
    [isDayFilter, 'nope', false],
    [isDayFilter, undefined, false],
    [isChannelFilter, 'desk', true],
    [isChannelFilter, 'api', false],
    [isDaySort, 'balance', true],
    [isDaySort, ['spot'], false],
  ] as const)('%p(%j) is %s', (guard, value, expected) => {
    expect(guard(value)).toBe(expected);
  });
});
