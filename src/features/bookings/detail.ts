// Booking detail (phase 1 "Scheda prenotazione"): what the sheet shows of
// the spot, the stay, the customer, the payments and the history. Pure.
import type { BookingDetail } from '@/api/types';
import type { OfflineOperation } from '@/features/offline/types';
import type { Abilities } from '@/features/permissions/permissions';
import { daysBetween, type CalendarDate } from '@/lib/calendar';
import type { Cents } from '@/lib/money';

type Customer = BookingDetail['customer'];
type Payment = BookingDetail['payments'][number];
type HistoryEntry = BookingDetail['history'][number];

/**
 * Contact details (email, phone) and the customer's own notes are shown only
 * to the roles that work with the customer at the desk, those that may write
 * bookings (owner, manager, cashier: spec 16.1). Beach staff and read-only
 * users see the name and the tags, enough to recognise the customer on the
 * beach: data minimisation (GDPR, core spec 23). The server sends the same
 * detail to every role with bookings.read; hiding here limits what the
 * screen exposes, not what the role may obtain.
 */
export function canSeeCustomerContacts(abilities: Pick<Abilities, 'canWriteBookings'>): boolean {
  return abilities.canWriteBookings;
}

export interface CustomerView {
  /** Display name; empty for an anonymised customer (the screen says "Cliente anonimo"). */
  name: string;
  anonymized: boolean;
  tags: string[];
  /** Present only when the role may see contacts and the customer has them. */
  email?: string;
  phone?: string;
  notes?: string;
}

/** What the sheet shows of the customer, given the role. */
export function customerView(customer: Customer, showContacts: boolean): CustomerView {
  const anonymized = !!customer.anonymized_at;
  if (anonymized) return { name: '', anonymized, tags: [] };
  const view: CustomerView = {
    name: customer.display_name.trim(),
    anonymized,
    tags: customer.tags,
  };
  if (showContacts) {
    if (customer.email) view.email = customer.email;
    if (customer.phone) view.phone = customer.phone;
    if (customer.notes.trim()) view.notes = customer.notes.trim();
  }
  return view;
}

export interface SpotLineView {
  id: string;
  /** Spot label; undefined while the line waits for an assignment. */
  spot?: string;
  pack?: string;
  /** Units, shown only for quantity zones (more than one). */
  quantity: number;
  total: Cents;
  extras: number;
  /** Spots and days of a stay split across spots (core 1.1, spec 30.6); undefined otherwise. */
  segments?: { spot?: string; from: CalendarDate; to: CalendarDate }[];
}

/** The lines of the booking: which spot, which pack, how much. */
export function spotLines(b: BookingDetail): SpotLineView[] {
  return b.lines.map((l) => {
    const split = l.segments && l.segments.length > 1 ? l.segments : undefined;
    return {
      id: l.id,
      spot: l.spot_label || undefined,
      pack: l.pack_code || undefined,
      quantity: l.quantity,
      total: l.line_total,
      extras: l.extras.length,
      segments: split?.map((s) => ({
        spot: s.spot_label || undefined,
        from: s.starts_on,
        to: s.ends_on,
      })),
    };
  });
}

/** Calendar days of the stay, both ends included. */
export function stayDays(b: Pick<BookingDetail, 'starts_on' | 'ends_on'>): number {
  return daysBetween(b.starts_on, b.ends_on) + 1;
}

export interface PaymentView {
  id: string;
  method: Payment['method'];
  status: Payment['status'];
  refund: boolean;
  /** Positive for a payment, negative for a refund. */
  signedAmount: Cents;
  at: string;
  test: boolean;
}

/** Payments and refunds, oldest first (the order they happened). */
export function paymentViews(b: BookingDetail): PaymentView[] {
  return [...b.payments]
    .sort((x, y) => x.created_at.localeCompare(y.created_at))
    .map((p) => ({
      id: p.id,
      method: p.method,
      status: p.status,
      refund: p.direction === 'refund',
      signedAmount: p.direction === 'refund' ? -p.amount : p.amount,
      at: p.created_at,
      test: !!p.test,
    }));
}

/** History actions the app names; others are shown as a generic activity. */
export const HISTORY_ACTIONS = [
  'booking.created',
  'booking.confirmed',
  'booking.checked_in',
  'booking.no_show',
  'booking.cancelled',
  'booking.rejected',
  'booking.expired',
  'booking.modified',
  'booking.moved',
  'booking.note_added',
  'booking.completed',
  'booking.refund_reserved',
  'booking.refund_succeeded',
  'booking.refund_failed',
  'booking.refund_retried',
  'payment.recorded',
  'payment.succeeded',
  'payment.refunded',
] as const;

export type HistoryAction = (typeof HISTORY_ACTIONS)[number];

export function isHistoryAction(v: string): v is HistoryAction {
  return (HISTORY_ACTIONS as readonly string[]).includes(v);
}

export interface HistoryView {
  key: string;
  at: string;
  /** Known action, or 'other'. */
  action: HistoryAction | 'other';
  actorType: HistoryEntry['actor_type'];
  actorName?: string;
}

/** Essential history: newest first, at most `limit` entries (all when omitted). */
export function historyViews(b: BookingDetail, limit?: number): HistoryView[] {
  const sorted = [...b.history].sort((x, y) => y.at.localeCompare(x.at));
  return sorted.slice(0, limit ?? sorted.length).map((e, i) => ({
    key: `${e.at}-${i}`,
    at: e.at,
    action: isHistoryAction(e.action) ? e.action : 'other',
    actorType: e.actor_type,
    actorName: e.actor_name || undefined,
  }));
}

/** Operations recorded on the device for this booking and not yet accepted by the instance. */
export function queuedFor(
  operations: readonly OfflineOperation[],
  bookingId: string,
): OfflineOperation[] {
  return operations.filter((op) => op.bookingId === bookingId);
}
