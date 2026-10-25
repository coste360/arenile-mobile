import { QueryClient } from '@tanstack/react-query';

import { estKeys } from '@/api/query-keys';
import type { BookingSummary, OperationsDay } from '@/api/types';
import {
  bookingSummary,
  EST_ID,
  operationalBooking,
  operationsDay,
  spot,
} from '@/test/operations-fixtures';

import { applyOptimistic, applyToBookings, applyToDay } from './optimistic';
import type { OfflineOperation } from './types';

const base = {
  id: 'op',
  idempotencyKey: 'key-0001',
  createdAt: '2026-10-25T08:00:00.000Z',
  seq: 1,
  status: 'pending' as const,
  scope: { instanceUrl: 'https://lido.example.it', establishmentId: EST_ID },
  bookingId: 'b-1',
  label: 'A1 · AR-7K3Q9',
};

describe('applyToDay', () => {
  it('checks in a confirmed booking and raises its version', () => {
    const day = applyToDay(operationsDay(), { ...base, kind: 'check_in' });
    expect(day.spots[0]).toMatchObject({
      status: 'checked_in',
      booking: { status: 'checked_in', version: 4 },
    });
    expect(day.totals.checked_in).toBe(1);
  });

  it('leaves a booking that is not confirmed as it is', () => {
    const before = operationsDay({
      spots: [
        spot({ status: 'checked_in', booking: operationalBooking({ status: 'checked_in' }) }),
      ],
    });
    const day = applyToDay(before, { ...base, kind: 'check_in' });
    expect(day.spots[0]).toEqual(before.spots[0]);
    expect(day.totals.checked_in).toBe(0);
  });

  it('adds a cash payment in cents, never below a zero balance', () => {
    const day = applyToDay(operationsDay(), { ...base, kind: 'cash_payment', amount: 2500 });
    expect(day.spots[0]!.booking).toMatchObject({
      paid_amount: 3500,
      balance_due: 0,
      version: 4,
    });
  });

  it('marks a note', () => {
    const day = applyToDay(operationsDay(), { ...base, kind: 'note', text: 'x' });
    expect(day.spots[0]!.booking).toMatchObject({ has_notes: true, version: 4 });
  });

  it.each([
    ['FULL', 'released', 'released', 'released'],
    ['AM', 'pass_holder', 'released', 'pass_holder'],
    [undefined, 'released', 'released', 'released'],
  ] as const)('releases the %s of a pass holder', (slots, status, am, pm) => {
    const before = operationsDay({
      spots: [
        spot({ status: 'pass_holder', booking: operationalBooking({ is_season_pass: true }) }),
      ],
    });
    const day = applyToDay(before, { ...base, kind: 'day_release', date: '2026-10-25', slots });
    expect(day.spots[0]).toMatchObject({ status, am_status: am, pm_status: pm });
  });

  it('does not release on another day', () => {
    const before = operationsDay({
      spots: [
        spot({ status: 'pass_holder', booking: operationalBooking({ is_season_pass: true }) }),
      ],
    });
    const day = applyToDay(before, { ...base, kind: 'day_release', date: '2026-10-26' });
    expect(day.spots[0]!.status).toBe('pass_holder');
  });

  it('ignores other bookings', () => {
    const before = operationsDay();
    const day = applyToDay(before, { ...base, bookingId: 'b-2', kind: 'check_in' });
    expect(day.spots).toEqual(before.spots);
  });
});

describe('applyToBookings', () => {
  it.each<[string, OfflineOperation, Partial<BookingSummary>]>([
    ['check-in', { ...base, kind: 'check_in' }, { status: 'checked_in', version: 4 }],
    [
      'cash',
      { ...base, kind: 'cash_payment', amount: 500 },
      { paid_amount: 1500, balance_due: 1500, version: 4 },
    ],
    ['note', { ...base, kind: 'note', text: 'x' }, { version: 4 }],
  ])('applies a %s', (_name, op, expected) => {
    expect(applyToBookings([bookingSummary()], op)[0]).toMatchObject(expected);
  });
});

describe('applyOptimistic', () => {
  it('updates every cached day and day list of the establishment', () => {
    const qc = new QueryClient();
    qc.setQueryData(estKeys.operationsDay(EST_ID, '2026-10-25'), operationsDay());
    qc.setQueryData(estKeys.bookingsOfDay(EST_ID, '2026-10-25'), [bookingSummary()]);
    qc.setQueryData(estKeys.operationsDay('other', '2026-10-25'), operationsDay());

    applyOptimistic(qc, { ...base, kind: 'check_in' });

    expect(
      qc.getQueryData<OperationsDay>(estKeys.operationsDay(EST_ID, '2026-10-25'))!.spots[0]!.status,
    ).toBe('checked_in');
    expect(
      qc.getQueryData<BookingSummary[]>(estKeys.bookingsOfDay(EST_ID, '2026-10-25'))![0]!.status,
    ).toBe('checked_in');
    expect(
      qc.getQueryData<OperationsDay>(estKeys.operationsDay('other', '2026-10-25'))!.spots[0]!
        .status,
    ).toBe('booked');
    qc.clear();
  });
});
