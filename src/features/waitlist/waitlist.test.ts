import { NetworkError, ProblemError } from '@/api/errors';
import { abilitiesFrom, ROLE_PERMISSIONS } from '@/features/permissions/permissions';
import { waitlistEntry } from '@/test/phase-2-routes';

import {
  canOfferWaitlist,
  canViewWaitlist,
  compatibleWith,
  freedSpotOf,
  offerable,
  offerSchema,
  statusOfView,
  toOfferCreate,
  waitlistErrorKey,
} from './waitlist';

const problem = (status: number, type: string) =>
  new ProblemError(status, { type: type as never, title: type, status });

describe('abilities', () => {
  it.each([
    ['owner', true, true],
    ['manager', true, true],
    ['cashier', true, true],
    ['beach_staff', true, false],
    ['viewer', true, false],
  ] as const)('%s → view %p, offer %p', (role, view, offer) => {
    const a = abilitiesFrom(new Set(ROLE_PERMISSIONS[role]), true);
    expect(canViewWaitlist(a)).toBe(view);
    expect(canOfferWaitlist(a)).toBe(offer);
  });
});

describe('statusOfView', () => {
  it.each([
    ['waiting', 'waiting'],
    ['offered', 'offered'],
    ['all', undefined],
  ] as const)('%s → %p', (view, status) => {
    expect(statusOfView(view)).toBe(status);
  });
});

describe('offerable', () => {
  it.each([
    ['waiting', true],
    ['offered', false],
    ['converted', false],
    ['expired', false],
    ['removed', false],
  ] as const)('%s → %p', (status, expected) => {
    expect(offerable({ status })).toBe(expected);
  });
});

describe('compatibleWith', () => {
  const entries = [
    waitlistEntry({ id: 'any' }),
    waitlistEntry({ id: 'zone-1', zone_id: 'z-1' }),
    waitlistEntry({ id: 'zone-2', zone_id: 'z-2' }),
    waitlistEntry({ id: 'spot-1', spot_id: 's-1' }),
    waitlistEntry({ id: 'spot-9', spot_id: 's-9' }),
    waitlistEntry({ id: 'later', starts_on: '2026-10-26', ends_on: '2026-10-28' }),
    waitlistEntry({ id: 'past', starts_on: '2026-10-20', ends_on: '2026-10-24' }),
    waitlistEntry({ id: 'offered', status: 'offered' }),
  ];

  it('keeps waiting entries for the day, the zone and the spot', () => {
    expect(
      compatibleWith(entries, { spotId: 's-1', zoneId: 'z-1' }, '2026-10-25').map((e) => e.id),
    ).toEqual(['any', 'zone-1', 'spot-1']);
  });
});

describe('offerSchema and toOfferCreate', () => {
  it.each([
    ['120', true],
    ['5', true],
    ['10080', true],
    ['4', false],
    ['10081', false],
    ['1.5', false],
    ['', false],
    ['abc', false],
  ])('%p → valid %p', (minutes, ok) => {
    expect(offerSchema.safeParse({ minutes }).success).toBe(ok);
  });

  it('sends the spot only when chosen', () => {
    expect(toOfferCreate(undefined, ' 120 ')).toEqual({ hold_minutes: 120 });
    expect(toOfferCreate('s-1', '60')).toEqual({ spot_id: 's-1', hold_minutes: 60 });
  });
});

describe('waitlistErrorKey', () => {
  it.each<[string, unknown, string]>([
    ['offline', new NetworkError('timeout'), 'waitlist.errors.offline'],
    ['403', problem(403, 'forbidden'), 'waitlist.errors.forbidden'],
    ['disabled', problem(409, 'waitlist_disabled'), 'waitlist.errors.disabled'],
    ['taken', problem(409, 'spot_unavailable'), 'waitlist.errors.unavailable'],
    ['zone full', problem(409, 'pool_exhausted'), 'waitlist.errors.unavailable'],
    ['agreement quota', problem(409, 'agreement_quota_exceeded'), 'waitlist.errors.unavailable'],
    ['already offered', problem(409, 'conflict'), 'waitlist.errors.alreadyOffered'],
    ['invalid', problem(422, 'validation_failed'), 'waitlist.errors.invalid'],
    ['gone', problem(404, 'not_found'), 'waitlist.errors.notFound'],
    ['other', problem(500, 'internal_error'), 'waitlist.errors.default'],
  ])('%s', (_name, e, key) => {
    expect(waitlistErrorKey(e)).toBe(key);
  });
});

describe('freedSpotOf', () => {
  it('needs every parameter and a valid date', () => {
    const all = { spotId: 's-4', zoneId: 'z-2', label: 'B1', date: '2026-10-25' };
    expect(freedSpotOf(all)).toEqual(all);
    expect(freedSpotOf({ ...all, label: undefined })).toBeUndefined();
    expect(freedSpotOf({ ...all, date: '25/10/2026' })).toBeUndefined();
    expect(freedSpotOf({})).toBeUndefined();
  });
});
