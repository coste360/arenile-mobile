// Bookings of the day (phase 1 "Prenotazioni del giorno"): filters, search
// and sort of the list, pure so that the "Oggi" figures and the filtered
// lists they open always agree. The counting rules mirror the core's
// operational totals (internal/store DayMovementsOn, inventory.ActiveStatuses).
import type { BookingStatus, BookingSummary } from '@/api/types';
import type { CalendarDate } from '@/lib/calendar';
import type { Cents } from '@/lib/money';

/** Statuses that occupy a spot (core inventory.ActiveStatuses). */
export const ACTIVE_STATUSES: readonly BookingStatus[] = [
  'held',
  'pending_payment',
  'awaiting_approval',
  'confirmed',
  'checked_in',
];

/**
 * Statuses hidden from the list unless the user asks for them: the booking
 * no longer concerns the day (cancelled, expired, rejected) or never did
 * (an unsaved draft).
 */
export const CLOSED_STATUSES: readonly BookingStatus[] = [
  'draft',
  'cancelled',
  'expired',
  'rejected',
];

export const isActive = (b: Pick<BookingSummary, 'status'>) => ACTIVE_STATUSES.includes(b.status);

/** Main filter of the list; each one is a figure of "Oggi". */
export type DayFilter = 'all' | 'arrivals' | 'present' | 'to_settle' | 'season_pass';
export const DAY_FILTERS: readonly DayFilter[] = [
  'all',
  'arrivals',
  'present',
  'to_settle',
  'season_pass',
];

/**
 * Sales channel filter. "Online" is every booking not made at the desk:
 * the public booking page and the API integrations (the badge tells them apart).
 */
export type ChannelFilter = 'all' | 'online' | 'desk';
export const CHANNEL_FILTERS: readonly ChannelFilter[] = ['all', 'online', 'desk'];

export type DaySort = 'spot' | 'customer' | 'arrival' | 'balance';
export const DAY_SORTS: readonly DaySort[] = ['spot', 'customer', 'arrival', 'balance'];

export function isDayFilter(v: unknown): v is DayFilter {
  return typeof v === 'string' && (DAY_FILTERS as readonly string[]).includes(v);
}
export function isChannelFilter(v: unknown): v is ChannelFilter {
  return typeof v === 'string' && (CHANNEL_FILTERS as readonly string[]).includes(v);
}
export function isDaySort(v: unknown): v is DaySort {
  return typeof v === 'string' && (DAY_SORTS as readonly string[]).includes(v);
}

/**
 * True when `b` belongs to `filter` on `date`:
 * - arrivals: active, not a season pass, starting on the day (like the core);
 * - present: checked in;
 * - to_settle: active with a balance still due;
 * - season_pass: active season passes covering the day.
 */
export function matchesFilter(b: BookingSummary, filter: DayFilter, date: CalendarDate): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'arrivals':
      return isActive(b) && !b.is_season_pass && b.starts_on === date;
    case 'present':
      return b.status === 'checked_in';
    case 'to_settle':
      return isActive(b) && b.balance_due > 0;
    case 'season_pass':
      return isActive(b) && b.is_season_pass;
  }
}

export function matchesChannel(b: BookingSummary, channel: ChannelFilter): boolean {
  if (channel === 'all') return true;
  return channel === 'desk' ? b.channel === 'desk' : b.channel !== 'desk';
}

/** Lower case without diacritics, for a search that finds "Nicolò" typing "nicolo". */
export function normalizeSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * True when every word of `query` appears in the booking code, the customer
 * name or a spot label ("rossi a1" finds Rossi on A1). Empty query matches.
 */
export function matchesSearch(b: BookingSummary, query: string): boolean {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeSearch([b.code, b.customer_display_name, ...b.spot_labels].join(' '));
  return words.every((w) => haystack.includes(w));
}

const collator = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

/** First spot label in natural order ("A2" before "A10"); bookings without a spot go last. */
function firstSpot(b: BookingSummary): string | undefined {
  return [...b.spot_labels].sort(collator.compare)[0];
}

function compareSpot(a: BookingSummary, b: BookingSummary): number {
  const sa = firstSpot(a);
  const sb = firstSpot(b);
  if (sa === undefined || sb === undefined) {
    if (sa === sb) return 0;
    return sa === undefined ? 1 : -1;
  }
  return collator.compare(sa, sb);
}

const COMPARATORS: Record<DaySort, (a: BookingSummary, b: BookingSummary) => number> = {
  spot: compareSpot,
  customer: (a, b) => collator.compare(a.customer_display_name, b.customer_display_name),
  arrival: (a, b) => a.starts_on.localeCompare(b.starts_on),
  balance: (a, b) => b.balance_due - a.balance_due,
};

/** Sorted copy; ties are broken by spot, then by booking code, so the order is stable. */
export function sortBookings(list: readonly BookingSummary[], sort: DaySort): BookingSummary[] {
  const primary = COMPARATORS[sort];
  return [...list].sort(
    (a, b) => primary(a, b) || compareSpot(a, b) || collator.compare(a.code, b.code),
  );
}

export interface DayListQuery {
  date: CalendarDate;
  filter: DayFilter;
  channel: ChannelFilter;
  search: string;
  sort: DaySort;
  /** Also list cancelled, expired, rejected and draft bookings. */
  includeClosed: boolean;
}

export const DEFAULT_DAY_LIST_QUERY: Omit<DayListQuery, 'date'> = {
  filter: 'all',
  channel: 'all',
  search: '',
  sort: 'spot',
  includeClosed: false,
};

/** The list the screen shows for `query`. */
export function selectBookings(
  list: readonly BookingSummary[],
  query: DayListQuery,
): BookingSummary[] {
  const shown = list.filter(
    (b) =>
      (query.includeClosed || !CLOSED_STATUSES.includes(b.status)) &&
      matchesFilter(b, query.filter, query.date) &&
      matchesChannel(b, query.channel) &&
      matchesSearch(b, query.search),
  );
  return sortBookings(shown, query.sort);
}

export interface DayBookingFigures {
  arrivals: number;
  present: number;
  toSettle: number;
  /** Sum of the balances of the bookings to settle. */
  toSettleAmount: Cents;
}

/** The booking figures of "Oggi": each one is the length of its filtered list. */
export function dayBookingFigures(
  list: readonly BookingSummary[],
  date: CalendarDate,
): DayBookingFigures {
  let arrivals = 0;
  let present = 0;
  let toSettle = 0;
  let toSettleAmount = 0;
  for (const b of list) {
    if (matchesFilter(b, 'arrivals', date)) arrivals++;
    if (matchesFilter(b, 'present', date)) present++;
    if (matchesFilter(b, 'to_settle', date)) {
      toSettle++;
      toSettleAmount += b.balance_due;
    }
  }
  return { arrivals, present, toSettle, toSettleAmount };
}
