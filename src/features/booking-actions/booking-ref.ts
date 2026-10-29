// The facts of a booking the operations need (check-in, release, note,
// cash), from whichever copy the device has: the detail when it was loaded,
// otherwise the booking as it appears in the cached day (operations/day or
// the day's list). Offline after a scan, the cached day is often all there is.
import type { QueryClient } from '@tanstack/react-query';

import { estKeys } from '@/api/query-keys';
import type {
  BookingDetail,
  BookingStatus,
  BookingSummary,
  OperationalBooking,
  OperationsDay,
  Slots,
} from '@/api/types';
import type { CalendarDate } from '@/lib/calendar';
import type { Cents } from '@/lib/money';

export interface BookingRef {
  id: string;
  code: string;
  status: BookingStatus;
  starts_on: CalendarDate;
  ends_on: CalendarDate;
  slots: Slots;
  is_season_pass: boolean;
  total_amount: Cents;
  paid_amount: Cents;
  balance_due: Cents;
  /** Version for the If-Match of the check-in. */
  version: number;
  /** Name shown to the staff (bookings.read); empty for anonymized customers. */
  customerName: string;
  spotLabels: string[];
  /** Internal notes, only known from the detail. */
  notesInternal?: string;
}

export function refFromDetail(d: BookingDetail): BookingRef {
  // A stay split across spots (core 1.1) names its spots in order (A2 → B4),
  // as one line: the comma stays for lines held at the same time.
  const labels = d.lines
    .map((l) =>
      l.segments && l.segments.length > 1
        ? l.segments
            .map((s) => s.spot_label)
            .filter((s): s is string => !!s)
            .join(' → ')
        : l.spot_label,
    )
    .filter((l): l is string => !!l);
  return {
    id: d.id,
    code: d.code,
    status: d.status,
    starts_on: d.starts_on,
    ends_on: d.ends_on,
    slots: d.slots,
    is_season_pass: d.is_season_pass,
    total_amount: d.total_amount,
    paid_amount: d.paid_amount,
    balance_due: d.balance_due,
    version: d.version,
    customerName: d.customer.display_name,
    spotLabels: [...new Set(labels)],
    notesInternal: d.notes_internal,
  };
}

export function refFromSummary(s: BookingSummary): BookingRef {
  return {
    id: s.id,
    code: s.code,
    status: s.status,
    starts_on: s.starts_on,
    ends_on: s.ends_on,
    slots: s.slots,
    is_season_pass: s.is_season_pass,
    total_amount: s.total_amount,
    paid_amount: s.paid_amount,
    balance_due: s.balance_due,
    version: s.version,
    customerName: s.customer_display_name,
    spotLabels: s.spot_labels,
  };
}

export function refFromOperational(b: OperationalBooking, spotLabels: string[]): BookingRef {
  return {
    id: b.booking_id,
    code: b.code,
    status: b.status,
    starts_on: b.starts_on,
    ends_on: b.ends_on,
    slots: b.slots,
    is_season_pass: b.is_season_pass,
    total_amount: b.total_amount,
    paid_amount: b.paid_amount,
    balance_due: b.balance_due,
    version: b.version,
    customerName: b.customer_anonymized ? '' : b.customer_display_name,
    spotLabels,
  };
}

function isOperationsDay(v: unknown): v is OperationsDay {
  return typeof v === 'object' && v !== null && Array.isArray((v as OperationsDay).spots);
}

/**
 * The booking matching `match` in the cached days of the establishment:
 * first the day lists, then the operations days (all the spots of a booking
 * collected). Undefined when no cached day has it.
 */
export function findCachedBooking(
  qc: QueryClient,
  establishmentId: string,
  match: (b: { id: string; code: string }) => boolean,
): BookingRef | undefined {
  for (const [, data] of qc.getQueriesData<unknown>({
    queryKey: [...estKeys.area(establishmentId, 'bookings'), 'day'],
  })) {
    if (!Array.isArray(data)) continue;
    const found = (data as BookingSummary[]).find((b) => match(b));
    if (found) return refFromSummary(found);
  }
  for (const [, data] of qc.getQueriesData<unknown>({
    queryKey: estKeys.area(establishmentId, 'operations'),
  })) {
    if (!isOperationsDay(data)) continue;
    const spots = data.spots.filter(
      (s) => s.booking && match({ id: s.booking.booking_id, code: s.booking.code }),
    );
    const first = spots[0]?.booking;
    if (first) return refFromOperational(first, [...new Set(spots.map((s) => s.label))]);
  }
  return undefined;
}

export const sameCode = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();
