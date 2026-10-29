import type { OperationalBooking, OperationalSpot } from '@/api/types';
import { mapDocument, mapSpot } from '@/test/map-fixtures';
import { operationalBooking, operationsDay, spot } from '@/test/operations-fixtures';

import { buildDaySpots } from './model';
import {
  filterOptions,
  filterSpots,
  matchesFilter,
  sameFilter,
  type QuickFilter,
} from './quick-filters';

const SEASIDE = { id: 'ag-1', name: 'Hotel Bellavista' };
const PARTNER = { id: 'p-1', name: 'Camping Pineta', kind: 'struttura_ricettiva' as const };

/** One spot per case, all on the map (the panel's quickFilters cases). */
const OPS: OperationalSpot[] = [
  spot({ spot_id: 's-1', label: 'A1', status: 'free' }),
  spot({
    spot_id: 's-2',
    label: 'A2',
    status: 'booked',
    booking: operationalBooking({ is_first_day: true, balance_due: 0, agreement: SEASIDE }),
  }),
  spot({
    spot_id: 's-3',
    label: 'A3',
    status: 'checked_in',
    booking: operationalBooking({ is_last_day: true, balance_due: 500, group_name: 'Scout' }),
  }),
  spot({
    spot_id: 's-4',
    label: 'A4',
    status: 'pass_holder',
    booking: operationalBooking({ balance_due: 0, partner: PARTNER, group_name: 'Scout' }),
  }),
  // Released pass day: the booking is there but the spot is free for the day.
  spot({
    spot_id: 's-5',
    label: 'A5',
    status: 'released',
    booking: operationalBooking({ is_first_day: true, balance_due: 900, agreement: SEASIDE }),
  }),
];

const spots = buildDaySpots({
  document: mapDocument({
    spots: OPS.map((s, i) => mapSpot({ id: s.spot_id, label: s.label, x: 50 + i * 60 })),
  }),
  day: operationsDay({ spots: OPS }),
  slot: 'FULL',
  canSeeCustomers: true,
  texts: { anonymous: 'Cliente anonimo', anonymousShort: 'Anonimo' },
});

const ids = (filter: QuickFilter) => filterSpots(spots, filter).map((s) => s.label);

describe('quick filters (spec 30.4)', () => {
  it.each<[string, QuickFilter, string[]]>([
    ['arrivals', { kind: 'arrivals' }, ['A2']],
    ['departures', { kind: 'departures' }, ['A3']],
    ['open balance', { kind: 'to_collect' }, ['A3']],
    ['present', { kind: 'present' }, ['A3']],
    ['an agreement', { kind: 'agreement', value: 'ag-1' }, ['A2']],
    ['a partner without agreement', { kind: 'agreement', value: 'p-1' }, ['A4']],
    ['a group', { kind: 'group', value: 'Scout' }, ['A3', 'A4']],
    ['an agreement without value', { kind: 'agreement' }, []],
    ['a group not on the day', { kind: 'group', value: 'Other' }, []],
  ])('%s', (_name, filter, want) => {
    expect(ids(filter)).toEqual(want);
  });

  it('never matches free spots or released pass days', () => {
    const released = spots.find((s) => s.label === 'A5')!;
    expect(matchesFilter(released, { kind: 'arrivals' })).toBe(false);
    expect(matchesFilter(released, { kind: 'to_collect' })).toBe(false);
  });

  it('offers the simple filters with counts, then agreements and groups of the day', () => {
    expect(
      filterOptions(spots).map((o) => [o.filter.kind, o.filter.value, o.name, o.count]),
    ).toEqual([
      ['arrivals', undefined, undefined, 1],
      ['departures', undefined, undefined, 1],
      ['to_collect', undefined, undefined, 1],
      ['present', undefined, undefined, 1],
      ['agreement', 'p-1', 'Camping Pineta', 1],
      ['agreement', 'ag-1', 'Hotel Bellavista', 1],
      ['group', 'Scout', 'Scout', 2],
    ]);
  });

  it('counts each chip as what it highlights when a booking has an agreement and a partner', () => {
    const withBoth: Partial<OperationalBooking> = { agreement: SEASIDE, partner: PARTNER };
    const three = buildDaySpots({
      document: mapDocument({
        spots: [
          mapSpot({ id: 's-1', label: 'A1' }),
          mapSpot({ id: 's-2', label: 'A2', x: 200 }),
          mapSpot({ id: 's-3', label: 'A3', x: 300 }),
        ],
      }),
      day: operationsDay({
        spots: [
          spot({ spot_id: 's-1', label: 'A1', booking: operationalBooking(withBoth) }),
          spot({ spot_id: 's-2', label: 'A2', booking: operationalBooking(withBoth) }),
          spot({ spot_id: 's-3', label: 'A3', booking: operationalBooking({ partner: PARTNER }) }),
        ],
      }),
      slot: 'FULL',
      canSeeCustomers: true,
      texts: { anonymous: 'Cliente anonimo', anonymousShort: 'Anonimo' },
    });
    const agreements = filterOptions(three).filter((o) => o.filter.kind === 'agreement');
    // The partner chip highlights its own booking and the two of the agreement with it.
    expect(agreements.map((o) => [o.filter.value, o.count])).toEqual([
      ['p-1', 3],
      ['ag-1', 2],
    ]);
    for (const o of agreements) expect(filterSpots(three, o.filter)).toHaveLength(o.count);
  });

  it.each<[QuickFilter | null, QuickFilter | null, boolean]>([
    [{ kind: 'arrivals' }, { kind: 'arrivals' }, true],
    [{ kind: 'group', value: 'a' }, { kind: 'group', value: 'a' }, true],
    [{ kind: 'group', value: 'a' }, { kind: 'group', value: 'b' }, false],
    [{ kind: 'arrivals' }, { kind: 'departures' }, false],
    [null, { kind: 'arrivals' }, false],
    [null, null, false],
  ])('sameFilter(%j, %j) is %s', (a, b, want) => {
    expect(sameFilter(a, b)).toBe(want);
  });
});
