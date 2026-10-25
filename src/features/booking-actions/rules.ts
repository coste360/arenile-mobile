// When each operation makes sense for a booking, mirroring the checks of the
// core domain services, so the app does not offer what the server would
// refuse anyway (it still judges: refusals show in the pending list).
import type { BookingStatus, Slots } from '@/api/types';
import { stayIncludes, type CalendarDate } from '@/lib/calendar';
import { parseCents, type Cents } from '@/lib/money';

import type { BookingRef } from './booking-ref';

export type CheckInState =
  /** Confirmed and the stay includes today: check-in offered. */
  | 'available'
  /** Already checked in (or queued: the cache shows it at once). */
  | 'done'
  /** Confirmed, but today is outside the stay (core booking_outside_period). */
  | 'outside_stay'
  /** Any other status (not paid yet, cancelled, no-show...): invalid transition. */
  | 'unavailable';

/** booking.Service.CheckIn: confirmed → checked_in, only during the stay. */
export function checkInState(
  b: Pick<BookingRef, 'status' | 'starts_on' | 'ends_on'>,
  today: CalendarDate,
): CheckInState {
  if (b.status === 'checked_in') return 'done';
  if (b.status !== 'confirmed') return 'unavailable';
  return stayIncludes(b, today) ? 'available' : 'outside_stay';
}

/** Statuses on which the core records a payment of an existing booking. */
const PAYABLE: readonly BookingStatus[] = [
  'held',
  'pending_payment',
  'awaiting_approval',
  'confirmed',
  'checked_in',
  'completed',
];

/**
 * Quick cash collection (payment.Service.RecordBookingPayment): a live
 * booking with a balance due. The amount never exceeds the balance (the app
 * does not offer the overpayment as credit of the panel).
 */
export function canCollect(b: Pick<BookingRef, 'status' | 'balance_due'>): boolean {
  return PAYABLE.includes(b.status) && b.balance_due > 0;
}

export type CashAmountError = 'amount_invalid' | 'amount_zero' | 'amount_over_balance';

/** Parses a typed cash amount against the balance due. */
export function validateCashAmount(
  input: string,
  balanceDue: Cents,
): { ok: true; amount: Cents } | { ok: false; error: CashAmountError } {
  const amount = parseCents(input);
  if (amount === null) return { ok: false, error: 'amount_invalid' };
  if (amount <= 0) return { ok: false, error: 'amount_zero' };
  if (amount > balanceDue) return { ok: false, error: 'amount_over_balance' };
  return { ok: true, amount };
}

/**
 * Days a season pass may release from the app (pass.Service.Release): today
 * and tomorrow (the offline window), inside the pass period, never the past.
 */
export function releasableDays(
  b: Pick<BookingRef, 'is_season_pass' | 'status' | 'starts_on' | 'ends_on'>,
  days: { today: CalendarDate; tomorrow: CalendarDate },
): CalendarDate[] {
  if (!b.is_season_pass || (b.status !== 'confirmed' && b.status !== 'checked_in')) return [];
  return [days.today, days.tomorrow].filter((d) => stayIncludes(b, d));
}

/** Half-days a pass may release: any of its own (a FULL pass may release AM or PM alone). */
export function releasableSlots(passSlots: Slots): Slots[] {
  return passSlots === 'FULL' ? ['FULL', 'AM', 'PM'] : [passSlots];
}

/** Core limits on a note (BookingNoteInput). */
export const NOTE_MAX_LENGTH = 2000;

/** Pending-list label: spot labels and booking code, never contact details. */
export function operationLabel(b: Pick<BookingRef, 'code' | 'spotLabels'>): string {
  return b.spotLabels.length ? `${b.spotLabels.join(', ')} · ${b.code}` : b.code;
}
