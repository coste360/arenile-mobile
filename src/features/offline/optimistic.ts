// Queued operations shown on the cached data while offline, so the map and
// the lists reflect what the staff did. The server's answer replaces these
// guesses after the replay (the affected areas are invalidated).
import type { QueryClient } from '@tanstack/react-query';

import { estKeys } from '@/api/query-keys';
import type { BookingDetail, BookingSummary, OperationalSpot, OperationsDay } from '@/api/types';

import type { OfflineOperation } from './types';

function isOperationsDay(v: unknown): v is OperationsDay {
  return typeof v === 'object' && v !== null && Array.isArray((v as OperationsDay).spots);
}

function isBookingList(v: unknown): v is BookingSummary[] {
  return Array.isArray(v);
}

function isBookingDetail(v: unknown): v is BookingDetail {
  return typeof v === 'object' && v !== null && typeof (v as BookingDetail).version === 'number';
}

type SpotStatus = OperationalSpot['status'];

/**
 * Pure: the operations day once `op` is applied. Every queued booking
 * operation raises the booking version on the server by one (check-in and
 * note through booking.Service.mutate, the cash payment through
 * ApplyBookingPayment), so the cached version is raised too.
 */
export function applyToDay(day: OperationsDay, op: OfflineOperation): OperationsDay {
  let checkedIn = 0;
  const spots = day.spots.map((spot): OperationalSpot => {
    const b = spot.booking;
    if (!b || b.booking_id !== op.bookingId) return spot;
    switch (op.kind) {
      case 'check_in': {
        if (b.status !== 'confirmed') return spot;
        checkedIn++;
        const swap = (s: SpotStatus | undefined) => (s === 'booked' ? 'checked_in' : s);
        return {
          ...spot,
          status: swap(spot.status) ?? spot.status,
          am_status: swap(spot.am_status),
          pm_status: swap(spot.pm_status),
          booking: { ...b, status: 'checked_in', version: b.version + 1 },
        };
      }
      case 'day_release': {
        if (day.date !== op.date || !b.is_season_pass) return spot;
        const half = (part: 'AM' | 'PM', s: SpotStatus | undefined) =>
          s === 'pass_holder' && (!op.slots || op.slots === 'FULL' || op.slots === part)
            ? 'released'
            : s;
        const am = half('AM', spot.am_status ?? spot.status);
        const pm = half('PM', spot.pm_status ?? spot.status);
        const status: SpotStatus =
          am === 'released' && pm === 'released' ? 'released' : spot.status;
        return { ...spot, status, am_status: am, pm_status: pm };
      }
      case 'note':
        return { ...spot, booking: { ...b, has_notes: true, version: b.version + 1 } };
      case 'cash_payment': {
        const paid = b.paid_amount + op.amount;
        return {
          ...spot,
          booking: {
            ...b,
            paid_amount: paid,
            balance_due: Math.max(0, b.total_amount - paid),
            version: b.version + 1,
          },
        };
      }
    }
  });
  const totals =
    checkedIn > 0 ? { ...day.totals, checked_in: day.totals.checked_in + checkedIn } : day.totals;
  return { ...day, spots, totals };
}

/** Pure: the bookings of a day once `op` is applied. */
export function applyToBookings(list: BookingSummary[], op: OfflineOperation): BookingSummary[] {
  return list.map((b) => {
    if (b.id !== op.bookingId) return b;
    switch (op.kind) {
      case 'check_in':
        return b.status === 'confirmed'
          ? { ...b, status: 'checked_in', version: b.version + 1 }
          : b;
      case 'cash_payment': {
        const paid = b.paid_amount + op.amount;
        return {
          ...b,
          paid_amount: paid,
          balance_due: Math.max(0, b.total_amount - paid),
          version: b.version + 1,
        };
      }
      case 'note':
        return { ...b, version: b.version + 1 };
      case 'day_release':
        return b;
    }
  });
}

/**
 * Pure: the booking detail once `op` is applied, so the booking sheet shows
 * the check-in, the cash collected and the note at once (the server adds a
 * note on a new line of notes_internal, booking.Service.AddNote).
 */
export function applyToDetail(detail: BookingDetail, op: OfflineOperation): BookingDetail {
  if (detail.id !== op.bookingId) return detail;
  switch (op.kind) {
    case 'check_in':
      return detail.status === 'confirmed'
        ? { ...detail, status: 'checked_in', version: detail.version + 1 }
        : detail;
    case 'cash_payment': {
      const paid = detail.paid_amount + op.amount;
      return {
        ...detail,
        paid_amount: paid,
        balance_due: Math.max(0, detail.total_amount - paid),
        version: detail.version + 1,
      };
    }
    case 'note': {
      const text = op.text.trim();
      const notes = detail.notes_internal ? `${detail.notes_internal}\n${text}` : text;
      return { ...detail, notes_internal: notes, version: detail.version + 1 };
    }
    case 'day_release':
      return detail;
  }
}

/** Applies `op` to every cached day, day list and detail of its establishment. */
export function applyOptimistic(qc: QueryClient, op: OfflineOperation): void {
  const { establishmentId } = op.scope;
  qc.setQueriesData<unknown>(
    { queryKey: estKeys.area(establishmentId, 'operations') },
    (old: unknown) => (isOperationsDay(old) ? applyToDay(old, op) : old),
  );
  qc.setQueriesData<unknown>(
    { queryKey: [...estKeys.area(establishmentId, 'bookings'), 'day'] },
    (old: unknown) => (isBookingList(old) ? applyToBookings(old, op) : old),
  );
  qc.setQueryData<unknown>(estKeys.booking(establishmentId, op.bookingId), (old: unknown) =>
    isBookingDetail(old) ? applyToDetail(old, op) : old,
  );
}

/** Areas refreshed after a queued operation was applied or refused. */
export function invalidateAfter(qc: QueryClient, op: OfflineOperation): void {
  const { establishmentId } = op.scope;
  for (const area of ['operations', 'bookings', 'season-passes', 'payments'] as const) {
    void qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, area) });
  }
}
