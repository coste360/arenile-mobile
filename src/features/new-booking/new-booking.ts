// New booking on the fly (core spec 7, 10; the panel's "Nuova prenotazione"):
// a spot, a stay from one day to another, a pack, the customer's surname.
// The price and the booking rules come from POST bookings/quote while the
// form changes; "Blocca" holds the spot for a while (POST holds, spec 7.4)
// and the booking converts that hold (hold_id). Online only (ADR 0009): the
// server guarantees the spot is free (409 spot_unavailable) and applies the
// rules (422 policy_violation). Mirrors the panel's
// web/admin/src/features/bookings/booking.schema.ts.
import { z } from 'zod';

import { isForbidden, NetworkError, ProblemError } from '@/api/errors';
import type {
  BookingCreate,
  BookingQuote,
  Extra,
  Formula,
  Hold,
  HoldCreate,
  OperationalSpot,
  Pack,
  Slots,
} from '@/api/types';
import { packsForSale } from '@/features/daily-sale/sale';
import { isBookable, slotStatus } from '@/features/day-map/status';
import type { Abilities } from '@/features/permissions/permissions';
import { matchSpots } from '@/features/spot-blocks/spot-search';
import { addDays, daysBetween, type CalendarDate } from '@/lib/calendar';

/** How long "Blocca" holds the spot (the core accepts 60 s – 24 h; the panel default is 10 min). */
export const HOLD_TTL_SECONDS = 15 * 60;

/** Longest stay the core accepts (validateStay: one year). */
export const MAX_STAY_DAYS = 367;

/** Quick lengths of the stay, in days (the last day is derived). */
export const STAY_LENGTHS = [1, 7, 14] as const;

/** Creating a booking or a hold needs bookings.write: cashier, manager, owner. */
export const canCreateBooking = (a: Pick<Abilities, 'canWriteBookings'>) => a.canWriteBookings;

export interface StayValues {
  spotId: string;
  zoneId: string;
  startsOn: CalendarDate;
  endsOn: CalendarDate;
  slots: Slots;
  packId: string;
  /** Quantity per extra id (0 = not taken). */
  extras: Record<string, number>;
}

/** Day or half day for one day, multi_day otherwise (the panel's defaultFormula). */
export function formulaFor(startsOn: CalendarDate, endsOn: CalendarDate, slots: Slots): Formula {
  if (startsOn === endsOn) return slots === 'FULL' ? 'day' : 'half_day';
  return 'multi_day';
}

/** Days of the stay, both ends included. */
export const stayLength = (startsOn: CalendarDate, endsOn: CalendarDate) =>
  daysBetween(startsOn, endsOn) + 1;

/** The last day of a stay of `days` days from `startsOn`. */
export const endFor = (startsOn: CalendarDate, days: number) => addDays(startsOn, days - 1);

/** A new first day keeps the length of the stay (or moves the last day along). */
export function withStart(
  stay: { startsOn: CalendarDate; endsOn: CalendarDate },
  startsOn: CalendarDate,
): { startsOn: CalendarDate; endsOn: CalendarDate } {
  const days = Math.max(1, stayLength(stay.startsOn, stay.endsOn));
  return { startsOn, endsOn: endFor(startsOn, days) };
}

/** True when the dates make a stay the core accepts. */
export function validStay(startsOn: CalendarDate, endsOn: CalendarDate): boolean {
  return endsOn >= startsOn && stayLength(startsOn, endsOn) <= MAX_STAY_DAYS;
}

/** Desk packs of the zone that allow the stay's formula, in display order. */
export function packsForStay(packs: readonly Pack[], zoneId: string, formula: Formula): Pack[] {
  return packsForSale(packs, zoneId).filter(
    (p) => !p.allowed_formulas?.length || p.allowed_formulas.includes(formula),
  );
}

/**
 * Spots free for the slots on the first day, filtered by label; the chosen
 * one stays first even when taken (the quote says why). The server checks
 * every other day of the stay.
 */
export function spotChoices(
  spots: readonly OperationalSpot[] | undefined,
  slots: Slots,
  query: string,
  chosenId?: string,
): { spots: OperationalSpot[]; more: boolean } {
  const all = spots ?? [];
  const free = all.filter((s) => s.spot_id !== chosenId && isBookable(slotStatus(s, slots)));
  const found = matchSpots(free, query);
  const chosen = all.find((s) => s.spot_id === chosenId);
  return chosen ? { spots: [chosen, ...found.spots], more: found.more } : found;
}

/**
 * Selection shared by the quote, the hold and the booking; null until the
 * spot, the pack and valid dates are chosen. Extras are sorted for a stable
 * query key; those attached to the line go on the line (the panel's toSelection).
 */
export function toSelection(
  v: StayValues,
  offered: readonly Pick<Extra, 'id' | 'attach_to'>[],
): BookingCreate | null {
  if (!v.spotId || !v.packId || !validStay(v.startsOn, v.endsOn)) return null;
  const byId = new Map(offered.map((x) => [x.id, x]));
  const chosen = Object.entries(v.extras)
    .filter(([id, q]) => q > 0 && byId.has(id))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([extra_id, quantity]) => ({ extra_id, quantity }));
  const lineExtras = chosen.filter((x) => byId.get(x.extra_id)?.attach_to === 'line');
  const extras = chosen.filter((x) => byId.get(x.extra_id)?.attach_to !== 'line');
  return {
    channel: 'desk',
    starts_on: v.startsOn,
    ends_on: v.endsOn,
    slots: v.slots,
    formula: formulaFor(v.startsOn, v.endsOn, v.slots),
    lines: [
      {
        pack_id: v.packId,
        spot_id: v.spotId,
        ...(v.zoneId ? { zone_id: v.zoneId } : {}),
        ...(lineExtras.length ? { extras: lineExtras } : {}),
      },
    ],
    ...(extras.length ? { extras } : {}),
  };
}

/** The hold of the selection's spot for the stay. */
export function toHoldRequest(selection: BookingCreate): HoldCreate {
  return {
    channel: 'desk',
    starts_on: selection.starts_on,
    ends_on: selection.ends_on,
    slots: selection.slots,
    items: selection.lines.map((l) => ({ spot_id: l.spot_id })),
    ttl_seconds: HOLD_TTL_SECONDS,
  };
}

/** "+39 333 123 4567" → "+393331234567"; without a prefix +39 (the panel's normalizePhone). */
export function normalizePhone(input: string): string {
  const compact = input.replace(/[\s().-]/g, '');
  if (compact === '') return '';
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  if (compact.startsWith('+')) return compact;
  return `+39${compact}`;
}

const PHONE_RE = /^\+[1-9][0-9]{6,14}$/;

/** The customer at the desk: only the surname is required (CustomerInput). */
export const customerSchema = z.object({
  lastName: z
    .string()
    .trim()
    .min(1, 'newBooking.form.lastNameRequired')
    .max(100, 'newBooking.form.tooLong'),
  firstName: z.string().trim().max(100, 'newBooking.form.tooLong'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || PHONE_RE.test(normalizePhone(v)), 'newBooking.form.phoneInvalid'),
  email: z
    .string()
    .trim()
    .max(254, 'newBooking.form.tooLong')
    .refine((v) => v === '' || z.email().safeParse(v).success, 'newBooking.form.emailInvalid'),
});

export type CustomerValues = z.infer<typeof customerSchema>;

/**
 * The booking: the selection, confirmed at the desk (payment recorded
 * afterwards), the new customer (deduplicated by the server on phone or
 * email) and the hold to convert, if any.
 */
export function toCreateRequest(
  selection: BookingCreate,
  customer: CustomerValues,
  holdId?: string,
): BookingCreate {
  const first = customer.firstName.trim();
  const email = customer.email.trim().toLowerCase();
  const phone = customer.phone.trim();
  return {
    ...selection,
    status: 'confirmed',
    customer: {
      last_name: customer.lastName.trim(),
      ...(first ? { first_name: first } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone: normalizePhone(phone) } : {}),
    },
    ...(holdId ? { hold_id: holdId } : {}),
  };
}

/** The selection a hold was made for, to tell when the form moved away from it. */
export const selectionKey = (selection: BookingCreate | null) =>
  selection
    ? JSON.stringify([
        selection.starts_on,
        selection.ends_on,
        selection.slots,
        selection.lines.map((l) => l.spot_id),
      ])
    : '';

/** The selection a hold covers (same shape as selectionKey). */
export const holdKey = (hold: Pick<Hold, 'starts_on' | 'ends_on' | 'slots' | 'items'> | null) =>
  hold
    ? JSON.stringify([hold.starts_on, hold.ends_on, hold.slots, hold.items.map((i) => i.spot_id)])
    : '';

/** True when the quote allows the booking: the spot is free and no rule is broken. */
export const quoteAllows = (q: Pick<BookingQuote, 'available' | 'policy'>) =>
  q.available && q.policy.violations.length === 0;

/** Seconds left on a hold (0 once expired). */
export function holdSecondsLeft(expiresAt: string, now: Date): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now.getTime()) / 1000));
}

export type NewBookingErrorKey =
  | 'newBooking.errors.offline'
  | 'newBooking.errors.forbidden'
  | 'newBooking.errors.spot_unavailable'
  | 'newBooking.errors.agreement'
  | 'newBooking.errors.no_price'
  | 'newBooking.errors.policy'
  | 'newBooking.errors.hold_expired'
  | 'newBooking.errors.invalid'
  | 'newBooking.errors.in_progress'
  | 'newBooking.errors.not_found'
  | 'newBooking.errors.default';

/** Message of a refused quote, hold or booking, from the core's stable problem slugs. */
export function newBookingErrorKey(e: unknown): NewBookingErrorKey {
  if (e instanceof NetworkError) return 'newBooking.errors.offline';
  if (isForbidden(e)) return 'newBooking.errors.forbidden';
  if (e instanceof ProblemError) {
    switch (e.type) {
      case 'spot_unavailable':
      case 'pool_exhausted':
      case 'quota_exceeded':
      case 'zone_full':
      // Core 1.1: the spots reserved to an agreement are used up.
      case 'agreement_quota_exceeded':
        return 'newBooking.errors.spot_unavailable';
      case 'agreement_not_applicable':
        return 'newBooking.errors.agreement';
      case 'no_price':
        return 'newBooking.errors.no_price';
      // The reasons come from policyViolationKeys (the rules of the establishment).
      case 'policy_violation':
        return 'newBooking.errors.policy';
      case 'hold_expired':
        return 'newBooking.errors.hold_expired';
      case 'validation_failed':
      case 'bad_request':
        return 'newBooking.errors.invalid';
      case 'idempotency_in_progress':
        return 'newBooking.errors.in_progress';
      default:
        if (e.status === 404) return 'newBooking.errors.not_found';
    }
  }
  return 'newBooking.errors.default';
}
