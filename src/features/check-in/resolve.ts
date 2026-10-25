// From a scanned or typed code to what the staff can do with it. Pure
// orchestration over injected lookups, so every path is tested without a
// network: the cached day answers offline, the instance answers the rest.
import { NetworkError } from '@/api/errors';
import type { Ticket } from '@/api/types';
import type { BookingRef } from '@/features/booking-actions/booking-ref';

import type { ScannedCode } from './scan-code';

export type Resolution =
  /** A booking: check-in and the other operations of its sheet. */
  | { type: 'booking'; booking: BookingRef }
  /** An entry ticket to admit at the gate with `code` (gate token, or the typed code when manual). */
  | { type: 'entry_ticket'; ticket: Ticket; code: string; manual: boolean }
  /** Today's ticket number, typed: the gate resolves it as a confirmed manual entry. */
  | { type: 'entry_number'; code: string }
  /** No booking or ticket has this code. */
  | { type: 'not_found' }
  /** Only the instance can answer and it is not reachable. */
  | { type: 'needs_connection' }
  /** Not an Arenile code. */
  | { type: 'unrecognized' };

export interface ResolveDeps {
  /** Is the instance reachable now (skips calls bound to fail). */
  online: boolean;
  /** The booking with this code in the cached days. */
  findCached(code: string): BookingRef | undefined;
  searchBooking(code: string): Promise<BookingRef | undefined>;
  ticketByCode(code: string): Promise<Ticket | undefined>;
  /** The booking of a sale ticket: from the cache when there, else the instance. */
  bookingById(id: string): Promise<BookingRef | undefined>;
}

async function online<T>(run: () => Promise<T>): Promise<T | 'offline'> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof NetworkError) return 'offline';
    throw e;
  }
}

async function fromTicket(
  ticket: Ticket,
  code: string,
  manual: boolean,
  deps: ResolveDeps,
): Promise<Resolution> {
  if (ticket.kind === 'entry') return { type: 'entry_ticket', ticket, code, manual };
  // A daily sale of a spot: its booking is checked in like any other.
  const booking = await online(() => deps.bookingById(ticket.booking_id));
  if (booking === 'offline') return { type: 'needs_connection' };
  return booking ? { type: 'booking', booking } : { type: 'not_found' };
}

/**
 * Resolves a code:
 * - booking QR → the cached booking, else the instance (exact code);
 * - ticket QR → the ticket (online only: gate tokens are never cached);
 *   an entry ticket goes to the gate, a daily sale to its booking;
 * - typed code (`manual`) → an entry ticket printed with that booking code
 *   first (it enters at the gate, not by booking check-in), then a booking;
 *   offline, the cached bookings only;
 * - typed ticket number → the gate, as a confirmed manual entry.
 * Other errors than the network (403, 5xx) are thrown to the caller.
 */
export async function resolveCode(
  scanned: ScannedCode,
  deps: ResolveDeps,
  { manual }: { manual: boolean },
): Promise<Resolution> {
  switch (scanned.kind) {
    case 'unknown':
      return { type: 'unrecognized' };
    case 'ticket_number':
      return deps.online
        ? { type: 'entry_number', code: String(scanned.number) }
        : { type: 'needs_connection' };
    case 'ticket': {
      if (!deps.online) return { type: 'needs_connection' };
      const ticket = await online(() => deps.ticketByCode(scanned.token));
      if (ticket === 'offline') return { type: 'needs_connection' };
      return ticket ? fromTicket(ticket, scanned.token, manual, deps) : { type: 'not_found' };
    }
    case 'booking': {
      const { code } = scanned;
      if (manual && deps.online) {
        const ticket = await online(() => deps.ticketByCode(code));
        if (ticket !== 'offline' && ticket?.kind === 'entry') {
          return { type: 'entry_ticket', ticket, code, manual: true };
        }
      }
      const cached = deps.findCached(code);
      if (cached) return { type: 'booking', booking: cached };
      if (!deps.online) return { type: 'needs_connection' };
      const found = await online(() => deps.searchBooking(code));
      if (found === 'offline') return { type: 'needs_connection' };
      return found ? { type: 'booking', booking: found } : { type: 'not_found' };
    }
  }
}
