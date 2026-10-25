import type { BookingStatus } from '@/api/types';

import {
  canCollect,
  checkInState,
  operationLabel,
  releasableDays,
  releasableSlots,
  validateCashAmount,
  type CheckInState,
} from './rules';

const TODAY = '2026-10-25';
const DAYS = { today: TODAY, tomorrow: '2026-10-26' };

describe('checkInState (booking.Service.CheckIn)', () => {
  it.each<[BookingStatus, string, string, CheckInState]>([
    ['confirmed', '2026-10-25', '2026-10-25', 'available'],
    ['confirmed', '2026-10-20', '2026-10-30', 'available'],
    ['confirmed', '2026-10-26', '2026-10-27', 'outside_stay'],
    ['confirmed', '2026-10-20', '2026-10-24', 'outside_stay'],
    ['checked_in', '2026-10-25', '2026-10-25', 'done'],
    ['pending_payment', '2026-10-25', '2026-10-25', 'unavailable'],
    ['cancelled', '2026-10-25', '2026-10-25', 'unavailable'],
    ['no_show', '2026-10-25', '2026-10-25', 'unavailable'],
  ])('%s from %s to %s → %s', (status, starts_on, ends_on, want) => {
    expect(checkInState({ status, starts_on, ends_on }, TODAY)).toBe(want);
  });
});

describe('canCollect', () => {
  it.each<[BookingStatus, number, boolean]>([
    ['confirmed', 2000, true],
    ['checked_in', 1, true],
    ['pending_payment', 500, true],
    ['confirmed', 0, false],
    ['cancelled', 2000, false],
    ['expired', 2000, false],
    ['draft', 2000, false],
  ])('%s with %i cents due → %s', (status, balance_due, want) => {
    expect(canCollect({ status, balance_due })).toBe(want);
  });
});

describe('validateCashAmount', () => {
  it.each([
    ['20', 2000, { ok: true, amount: 2000 }],
    ['12,50', 2000, { ok: true, amount: 1250 }],
    ['€ 0,01', 2000, { ok: true, amount: 1 }],
    ['20,01', 2000, { ok: false, error: 'amount_over_balance' }],
    ['0', 2000, { ok: false, error: 'amount_zero' }],
    ['abc', 2000, { ok: false, error: 'amount_invalid' }],
    ['1.250,00', 200000, { ok: false, error: 'amount_invalid' }],
    ['', 2000, { ok: false, error: 'amount_invalid' }],
  ])('%j with %i due', (input, due, want) => {
    expect(validateCashAmount(input, due)).toEqual(want);
  });
});

describe('releasableDays (pass.Service.Release)', () => {
  const pass = {
    is_season_pass: true,
    status: 'confirmed' as BookingStatus,
    starts_on: '2026-06-01',
    ends_on: '2026-10-31',
  };

  it('offers today and tomorrow inside the pass period', () => {
    expect(releasableDays(pass, DAYS)).toEqual([TODAY, '2026-10-26']);
  });

  it('stops at the end of the pass', () => {
    expect(releasableDays({ ...pass, ends_on: TODAY }, DAYS)).toEqual([TODAY]);
  });

  it.each([
    ['an ordinary booking', { ...pass, is_season_pass: false }],
    ['a cancelled pass', { ...pass, status: 'cancelled' as BookingStatus }],
    ['an expired pass', { ...pass, ends_on: '2026-09-30' }],
  ])('offers nothing for %s', (_, b) => {
    expect(releasableDays(b, DAYS)).toEqual([]);
  });
});

describe('releasableSlots', () => {
  it.each([
    ['FULL', ['FULL', 'AM', 'PM']],
    ['AM', ['AM']],
    ['PM', ['PM']],
  ] as const)('%s pass → %j', (slots, want) => {
    expect(releasableSlots(slots)).toEqual(want);
  });
});

describe('operationLabel', () => {
  it.each([
    [['A1'], 'A1 · AR-7K3Q9'],
    [['A1', 'A2'], 'A1, A2 · AR-7K3Q9'],
    [[], 'AR-7K3Q9'],
  ])('%j', (spotLabels, want) => {
    expect(operationLabel({ code: 'AR-7K3Q9', spotLabels })).toBe(want);
  });
});
