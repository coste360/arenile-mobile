import { NetworkError, ProblemError } from '@/api/errors';
import type { BookingCreate, Formula, Slots } from '@/api/types';
import { abilitiesFrom, ROLE_PERMISSIONS } from '@/features/permissions/permissions';
import { spot } from '@/test/operations-fixtures';
import { pack } from '@/test/phase-2-routes';

import {
  canCreateBooking,
  customerSchema,
  endFor,
  formulaFor,
  holdKey,
  holdSecondsLeft,
  HOLD_TTL_SECONDS,
  newBookingErrorKey,
  normalizePhone,
  packsForStay,
  quoteAllows,
  selectionKey,
  spotChoices,
  stayLength,
  toCreateRequest,
  toHoldRequest,
  toSelection,
  validStay,
  withStart,
  type StayValues,
} from './new-booking';

const values = (overrides: Partial<StayValues> = {}): StayValues => ({
  spotId: 's-1',
  zoneId: 'z-1',
  startsOn: '2026-10-25',
  endsOn: '2026-10-31',
  slots: 'FULL',
  packId: 'p-1',
  extras: {},
  ...overrides,
});

const problem = (status: number, type: string) =>
  new ProblemError(status, { type: type as never, title: type, status });

describe('canCreateBooking', () => {
  it.each([
    ['owner', true],
    ['manager', true],
    ['cashier', true],
    ['beach_staff', false],
    ['viewer', false],
  ] as const)('%s → %p', (role, expected) => {
    expect(canCreateBooking(abilitiesFrom(new Set(ROLE_PERMISSIONS[role]), true))).toBe(expected);
  });
});

describe('formulaFor', () => {
  it.each<[string, string, Slots, Formula]>([
    ['2026-10-25', '2026-10-25', 'FULL', 'day'],
    ['2026-10-25', '2026-10-25', 'AM', 'half_day'],
    ['2026-10-25', '2026-10-25', 'PM', 'half_day'],
    ['2026-10-25', '2026-10-26', 'FULL', 'multi_day'],
    ['2026-10-25', '2026-11-07', 'AM', 'multi_day'],
  ])('%s → %s %s = %s', (from, to, slots, want) => {
    expect(formulaFor(from, to, slots)).toBe(want);
  });
});

describe('stay dates', () => {
  it.each([
    ['2026-10-25', '2026-10-25', 1],
    ['2026-10-25', '2026-10-31', 7],
    ['2026-10-31', '2026-11-01', 2],
  ])('%s → %s lasts %i days', (from, to, days) => {
    expect(stayLength(from, to)).toBe(days);
    expect(endFor(from, days)).toBe(to);
  });

  it('keeps the length when the first day changes', () => {
    expect(withStart({ startsOn: '2026-10-25', endsOn: '2026-10-31' }, '2026-11-02')).toEqual({
      startsOn: '2026-11-02',
      endsOn: '2026-11-08',
    });
  });

  it.each([
    ['one day', '2026-10-25', '2026-10-25', true],
    ['a week', '2026-10-25', '2026-10-31', true],
    ['the end before the start', '2026-10-25', '2026-10-24', false],
    ['a whole year and a day', '2026-01-01', '2027-01-02', true],
    ['longer than the core allows', '2026-01-01', '2027-01-03', false],
  ])('%s', (_name, from, to, want) => {
    expect(validStay(from, to)).toBe(want);
  });
});

describe('packsForStay', () => {
  const packs = [
    pack({ id: 'p-day', allowed_formulas: ['day', 'half_day'], sort_order: 1 }),
    pack({ id: 'p-multi', allowed_formulas: ['multi_day', 'week'], sort_order: 2 }),
    pack({ id: 'p-online', allowed_formulas: ['multi_day'], channels: ['online'] }),
    pack({ id: 'p-z2', allowed_formulas: ['multi_day'], allowed_zone_ids: ['z-2'], sort_order: 3 }),
    pack({ id: 'p-off', allowed_formulas: ['multi_day'], active: false }),
  ];

  it.each<[Formula, string, string[]]>([
    ['day', 'z-1', ['p-day']],
    ['multi_day', 'z-1', ['p-multi']],
    ['multi_day', 'z-2', ['p-multi', 'p-z2']],
    ['season', 'z-1', []],
  ])('%s in %s', (formula, zone, want) => {
    expect(packsForStay(packs, zone, formula).map((p) => p.id)).toEqual(want);
  });
});

describe('spotChoices', () => {
  const spots = [
    spot({ spot_id: 's-10', label: 'A10', status: 'free' }),
    spot({ spot_id: 's-2', label: 'A2', status: 'free' }),
    spot({ spot_id: 's-3', label: 'A3', status: 'booked' }),
    spot({ spot_id: 's-4', label: 'B1', status: 'released' }),
    spot({ spot_id: 's-5', label: 'B2', status: 'booked', pm_status: 'free' }),
  ];

  it.each<[string, Slots, string, string | undefined, string[]]>([
    ['free and released spots, in label order', 'FULL', '', undefined, ['A2', 'A10', 'B1']],
    ['the afternoon adds a spot free after lunch', 'PM', '', undefined, ['A2', 'A10', 'B1', 'B2']],
    ['filtered by label', 'FULL', 'b', undefined, ['B1']],
    ['the chosen spot first, even when taken', 'FULL', '', 's-3', ['A3', 'A2', 'A10', 'B1']],
    ['the chosen spot is never listed twice', 'FULL', '', 's-2', ['A2', 'A10', 'B1']],
  ])('%s', (_name, slots, query, chosen, want) => {
    expect(spotChoices(spots, slots, query, chosen).spots.map((s) => s.label)).toEqual(want);
  });

  it('is empty without the day', () => {
    expect(spotChoices(undefined, 'FULL', '')).toEqual({ spots: [], more: false });
  });
});

describe('toSelection', () => {
  const offered = [
    { id: 'x-booking', attach_to: 'booking' as const },
    { id: 'x-line', attach_to: 'line' as const },
  ];

  it('builds a desk stay on the spot', () => {
    expect(toSelection(values(), offered)).toEqual({
      channel: 'desk',
      starts_on: '2026-10-25',
      ends_on: '2026-10-31',
      slots: 'FULL',
      formula: 'multi_day',
      lines: [{ pack_id: 'p-1', spot_id: 's-1', zone_id: 'z-1' }],
    });
  });

  it('puts line extras on the line and drops the ones not offered', () => {
    const s = toSelection(
      values({ extras: { 'x-line': 2, 'x-booking': 1, 'x-gone': 3, 'x-zero': 0 } }),
      offered,
    );
    expect(s?.lines[0]?.extras).toEqual([{ extra_id: 'x-line', quantity: 2 }]);
    expect(s?.extras).toEqual([{ extra_id: 'x-booking', quantity: 1 }]);
  });

  it.each<[string, Partial<StayValues>]>([
    ['no spot', { spotId: '' }],
    ['no pack', { packId: '' }],
    ['the end before the start', { endsOn: '2026-10-24' }],
  ])('is null with %s', (_name, overrides) => {
    expect(toSelection(values(overrides), offered)).toBeNull();
  });
});

describe('holds', () => {
  const selection = toSelection(values({ slots: 'AM' }), []) as BookingCreate;

  it('holds the spot for the stay, for the screen time', () => {
    expect(toHoldRequest(selection)).toEqual({
      channel: 'desk',
      starts_on: '2026-10-25',
      ends_on: '2026-10-31',
      slots: 'AM',
      items: [{ spot_id: 's-1' }],
      ttl_seconds: HOLD_TTL_SECONDS,
    });
  });

  it('matches the hold to the selection it was made for', () => {
    const hold = { ...toHoldRequest(selection) };
    expect(holdKey(hold)).toBe(selectionKey(selection));
    const other = toSelection(values({ slots: 'AM', spotId: 's-2' }), []);
    expect(holdKey(hold)).not.toBe(selectionKey(other));
    expect(holdKey(null)).toBe('');
    expect(selectionKey(null)).toBe('');
  });

  it.each([
    ['2026-10-25T10:15:00Z', '2026-10-25T10:00:00Z', 900],
    ['2026-10-25T10:15:00Z', '2026-10-25T10:14:59.500Z', 1],
    ['2026-10-25T10:15:00Z', '2026-10-25T10:15:00Z', 0],
    ['2026-10-25T10:15:00Z', '2026-10-25T11:00:00Z', 0],
  ])('a hold until %s has seconds left at %s', (expires, now, left) => {
    expect(holdSecondsLeft(expires, new Date(now))).toBe(left);
  });
});

describe('customer', () => {
  it.each([
    ['+39 333 123 4567', '+393331234567'],
    ['333 1234567', '+393331234567'],
    ['0041 79 123 45 67', '+41791234567'],
    ['(333) 123-4567', '+393331234567'],
    ['', ''],
  ])('normalizePhone(%j) = %j', (input, want) => {
    expect(normalizePhone(input)).toBe(want);
  });

  const valid = { lastName: 'Rossi', firstName: '', phone: '', email: '' };
  it.each<[string, Partial<typeof valid>, string | null]>([
    ['the surname alone', {}, null],
    ['with phone and email', { phone: '333 1234567', email: 'a@b.it' }, null],
    ['no surname', { lastName: '  ' }, 'newBooking.form.lastNameRequired'],
    ['a bad phone', { phone: '12' }, 'newBooking.form.phoneInvalid'],
    ['a bad email', { email: 'rossi@' }, 'newBooking.form.emailInvalid'],
    ['a long name', { firstName: 'x'.repeat(101) }, 'newBooking.form.tooLong'],
  ])('%s', (_name, overrides, error) => {
    const r = customerSchema.safeParse({ ...valid, ...overrides });
    expect(r.success ? null : r.error.issues[0]?.message).toBe(error);
  });

  it('creates a confirmed booking with the new customer and the hold', () => {
    const selection = toSelection(values(), []) as BookingCreate;
    const body = toCreateRequest(
      selection,
      { lastName: ' Rossi ', firstName: 'Anna', phone: '333 1234567', email: ' Anna@Example.IT ' },
      'h-1',
    );
    expect(body).toEqual({
      ...selection,
      status: 'confirmed',
      customer: {
        last_name: 'Rossi',
        first_name: 'Anna',
        email: 'anna@example.it',
        phone: '+393331234567',
      },
      hold_id: 'h-1',
    });
  });

  it('leaves out the empty fields and a missing hold', () => {
    const selection = toSelection(values(), []) as BookingCreate;
    const body = toCreateRequest(selection, {
      lastName: 'Rossi',
      firstName: '',
      phone: '',
      email: '',
    });
    expect(body.customer).toEqual({ last_name: 'Rossi' });
    expect(body).not.toHaveProperty('hold_id');
  });
});

describe('quoteAllows', () => {
  const policy = (codes: string[]) =>
    ({ rules: {}, violations: codes.map((code) => ({ code })) }) as never;
  it.each([
    ['free, no rule broken', true, [], true],
    ['taken', false, [], false],
    ['a rule broken', true, ['same_day_closed'], false],
  ] as const)('%s', (_name, available, codes, want) => {
    expect(quoteAllows({ available, policy: policy([...codes]) })).toBe(want);
  });
});

describe('newBookingErrorKey', () => {
  it.each<[unknown, string]>([
    [new NetworkError('unreachable'), 'newBooking.errors.offline'],
    [problem(403, 'forbidden'), 'newBooking.errors.forbidden'],
    [problem(409, 'spot_unavailable'), 'newBooking.errors.spot_unavailable'],
    [problem(409, 'pool_exhausted'), 'newBooking.errors.spot_unavailable'],
    [problem(409, 'quota_exceeded'), 'newBooking.errors.spot_unavailable'],
    [problem(409, 'agreement_quota_exceeded'), 'newBooking.errors.spot_unavailable'],
    [problem(422, 'agreement_not_applicable'), 'newBooking.errors.agreement'],
    [problem(422, 'no_price'), 'newBooking.errors.no_price'],
    [problem(422, 'policy_violation'), 'newBooking.errors.policy'],
    [problem(410, 'hold_expired'), 'newBooking.errors.hold_expired'],
    [problem(422, 'validation_failed'), 'newBooking.errors.invalid'],
    [problem(400, 'bad_request'), 'newBooking.errors.invalid'],
    [problem(409, 'idempotency_in_progress'), 'newBooking.errors.in_progress'],
    [problem(404, 'not_found'), 'newBooking.errors.not_found'],
    [problem(500, 'internal_error'), 'newBooking.errors.default'],
    [new Error('boom'), 'newBooking.errors.default'],
  ])('%s → %s', (e, want) => {
    expect(newBookingErrorKey(e)).toBe(want);
  });
});
