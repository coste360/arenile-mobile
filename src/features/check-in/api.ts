// Online calls of the check-in by code: finding a booking by its code,
// reading a ticket from its QR and admitting an entry ticket at the gate.
// None of these can be queued: the answer is what the staff acts on.
import { request, type ApiClient } from '@/api/client';
import { ProblemError } from '@/api/errors';
import type { GateCheckInResult, Ticket } from '@/api/types';
import { fetchBooking } from '@/features/bookings/queries';
import {
  refFromDetail,
  refFromSummary,
  sameCode,
  type BookingRef,
} from '@/features/booking-actions/booking-ref';

const EST = '/api/admin/v1/establishments/{establishmentId}' as const;

const isNotFound = (e: unknown) => e instanceof ProblemError && e.status === 404;

/**
 * GET bookings?q=code: the booking whose code is exactly `code` (the search
 * also matches names and phones, so only an exact code counts).
 */
export async function searchBookingByCode(
  client: ApiClient,
  establishmentId: string,
  code: string,
): Promise<BookingRef | undefined> {
  const res = await request(() =>
    client.GET(`${EST}/bookings`, {
      params: { path: { establishmentId }, query: { q: code, limit: 20 } },
    }),
  );
  const found = res.items.find((b) => sameCode(b.code, code));
  return found ? refFromSummary(found) : undefined;
}

/** GET bookings/{id} as a BookingRef; undefined when it does not exist. */
export async function bookingRefById(
  client: ApiClient,
  establishmentId: string,
  bookingId: string,
): Promise<BookingRef | undefined> {
  try {
    return refFromDetail(await fetchBooking(client, establishmentId, bookingId));
  } catch (e) {
    if (isNotFound(e)) return undefined;
    throw e;
  }
}

/**
 * GET tickets/by-code/{code}: the ticket of a gate token or of the booking
 * code printed under its QR (bookings.read). Undefined when no ticket has it.
 */
export async function ticketByCode(
  client: ApiClient,
  establishmentId: string,
  code: string,
): Promise<Ticket | undefined> {
  try {
    return await request(() =>
      client.GET(`${EST}/tickets/by-code/{bookingCode}`, {
        params: { path: { establishmentId, bookingCode: code } },
      }),
    );
  } catch (e) {
    if (isNotFound(e)) return undefined;
    throw e;
  }
}

/**
 * POST entry-gate/check-in (operations.run): one entry per ticket, decided
 * by the server with a conditional update (never twice, even from two
 * phones). `manual` admits a typed ticket number or booking code and is
 * recorded in the audit log; a scanned QR never sets it.
 */
export function admitEntry(
  client: ApiClient,
  establishmentId: string,
  code: string,
  manual: boolean,
): Promise<GateCheckInResult> {
  return request(() =>
    client.POST(`${EST}/entry-gate/check-in`, {
      params: { path: { establishmentId } },
      body: { code, ...(manual ? { manual: true } : {}) },
    }),
  );
}
