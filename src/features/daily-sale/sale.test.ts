import { NetworkError, ProblemError } from '@/api/errors';
import type { Slots } from '@/api/types';
import { abilitiesFrom, ROLE_PERMISSIONS } from '@/features/permissions/permissions';
import { spot } from '@/test/operations-fixtures';
import { extra, pack } from '@/test/phase-2-routes';

import {
  canSell,
  changeDue,
  extrasForPack,
  packsForSale,
  saleErrorKey,
  saleFormSchema,
  sellableSpot,
  toCreateRequest,
  toQuoteRequest,
  type SaleValues,
} from './sale';

const values = (overrides: Partial<SaleValues> = {}): SaleValues => ({
  date: '2026-10-25',
  slots: 'FULL',
  spotId: 's-1',
  packId: 'p-1',
  extras: {},
  firstName: '',
  lastName: '',
  ...overrides,
});

const problem = (status: number, type: string) =>
  new ProblemError(status, { type: type as never, title: type, status });

describe('canSell', () => {
  it.each([
    ['owner', true],
    ['manager', true],
    ['cashier', true],
    ['beach_staff', false],
    ['viewer', false],
  ] as const)('%s → %p', (role, expected) => {
    expect(canSell(abilitiesFrom(new Set(ROLE_PERMISSIONS[role]), true))).toBe(expected);
  });
});

describe('sellableSpot', () => {
  it.each<[string, Parameters<typeof spot>[0], Slots, boolean]>([
    ['free all day', { status: 'free' }, 'FULL', true],
    ['a released pass day', { status: 'released' }, 'FULL', true],
    ['booked', { status: 'booked' }, 'FULL', false],
    ['blocked', { status: 'blocked' }, 'FULL', false],
    ['free in the afternoon', { status: 'booked', pm_status: 'free' }, 'PM', true],
    ['booked in the morning', { status: 'booked', am_status: 'booked' }, 'AM', false],
  ])('%s', (_name, s, slots, expected) => {
    expect(sellableSpot(spot(s), slots)).toBe(expected);
  });

  it('is false for an unknown spot', () => {
    expect(sellableSpot(undefined, 'FULL')).toBe(false);
  });
});

describe('packsForSale', () => {
  const packs = [
    pack({ id: 'p-3', sort_order: 3 }),
    pack({ id: 'p-1', sort_order: 1 }),
    pack({ id: 'p-off', active: false }),
    pack({ id: 'p-online', channels: ['online'] }),
    pack({ id: 'p-all', channels: [], sort_order: 2 }),
    pack({ id: 'p-z2', allowed_zone_ids: ['z-2'] }),
    pack({ id: 'p-z1', allowed_zone_ids: ['z-1'], sort_order: 4 }),
  ];

  it('keeps active desk packs allowed in the zone, in display order', () => {
    expect(packsForSale(packs, 'z-1').map((p) => p.id)).toEqual(['p-1', 'p-all', 'p-3', 'p-z1']);
  });
});

describe('extrasForPack', () => {
  it('keeps active extras offered with the pack, in display order', () => {
    const extras = [
      extra({ id: 'x-2', sort_order: 2 }),
      extra({ id: 'x-1', sort_order: 1 }),
      extra({ id: 'x-off', active: false }),
      extra({ id: 'x-p2', allowed_pack_ids: ['p-2'] }),
      extra({ id: 'x-p1', allowed_pack_ids: ['p-1'], sort_order: 3 }),
    ];
    expect(extrasForPack(extras, 'p-1').map((x) => x.id)).toEqual(['x-1', 'x-2', 'x-p1']);
  });
});

describe('toQuoteRequest', () => {
  it('is null without a pack', () => {
    expect(toQuoteRequest(values({ packId: '' }))).toBeNull();
  });

  it('sends the spot, the slot and the extras taken, sorted', () => {
    expect(
      toQuoteRequest(values({ slots: 'AM', extras: { 'x-2': 1, 'x-1': 2, 'x-3': 0 } })),
    ).toEqual({
      date: '2026-10-25',
      slots: 'AM',
      pack_id: 'p-1',
      spot_id: 's-1',
      extras: [
        { extra_id: 'x-1', quantity: 2 },
        { extra_id: 'x-2', quantity: 1 },
      ],
    });
  });
});

describe('toCreateRequest', () => {
  it('adds the cash session, the tendered amount, the name and the total seen', () => {
    expect(
      toCreateRequest(values({ firstName: ' Mario ', lastName: '', tendered: 5000 }), 'cash', {
        cashSessionId: 'cs-1',
        expectedTotal: 2500,
      }),
    ).toEqual({
      date: '2026-10-25',
      slots: 'FULL',
      pack_id: 'p-1',
      spot_id: 's-1',
      payment: { method: 'cash', cash_session_id: 'cs-1', tendered_amount: 5000 },
      holder: { first_name: 'Mario' },
      expected_total: 2500,
    });
  });

  it('never sends cash details with a card payment', () => {
    expect(toCreateRequest(values({ tendered: 5000 }), 'card', { cashSessionId: 'cs-1' })).toEqual({
      date: '2026-10-25',
      slots: 'FULL',
      pack_id: 'p-1',
      spot_id: 's-1',
      payment: { method: 'card' },
    });
  });
});

describe('changeDue', () => {
  it.each<[number, number | undefined, number | undefined]>([
    [2500, 5000, 2500],
    [2500, 2500, 0],
    [2500, 2000, undefined],
    [2500, undefined, undefined],
    [2500, 0, undefined],
  ])('total %d, tendered %p → %p', (total, tendered, expected) => {
    expect(changeDue(total, tendered)).toBe(expected);
  });
});

describe('saleFormSchema', () => {
  it.each([
    [{ firstName: '', lastName: '', tendered: '' }, true],
    [{ firstName: 'Mario', lastName: 'Rossi', tendered: '50' }, true],
    [{ firstName: '', lastName: '', tendered: '12,50' }, true],
    [{ firstName: '', lastName: '', tendered: 'abc' }, false],
    [{ firstName: 'x'.repeat(101), lastName: '', tendered: '' }, false],
  ])('%p → valid %p', (input, ok) => {
    expect(saleFormSchema.safeParse(input).success).toBe(ok);
  });
});

describe('saleErrorKey', () => {
  it.each<[string, unknown, string]>([
    ['offline', new NetworkError('unreachable'), 'sale.errors.offline'],
    ['403', problem(403, 'forbidden'), 'sale.errors.forbidden'],
    ['taken', problem(409, 'spot_unavailable'), 'sale.errors.spot_unavailable'],
    ['cash desk closed', problem(409, 'cash_session_closed'), 'sale.errors.cash_session_closed'],
    ['price changed', problem(409, 'price_changed'), 'sale.errors.price_changed'],
    ['no price', problem(422, 'no_price'), 'sale.errors.no_price'],
    ['in progress', problem(409, 'idempotency_in_progress'), 'sale.errors.in_progress'],
    ['missing', problem(404, 'not_found'), 'sale.errors.not_found'],
    ['other', problem(500, 'internal_error'), 'sale.errors.default'],
  ])('%s', (_name, e, key) => {
    expect(saleErrorKey(e)).toBe(key);
  });
});
