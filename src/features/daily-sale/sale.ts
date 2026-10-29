// Daily quick sale from the map (core spec 14.3, ADR 0020 of the core;
// spec 03 of this app): a confirmed desk booking, its manual payment and the
// numbered ticket, created by the server in one transaction. Online only:
// the server guarantees the spot is free (409 spot_unavailable) and numbers
// the ticket. The app sells spot-first only (the spot tapped on the map);
// zone-first sales stay in the panel. Mirrors the panel's
// web/admin/src/features/daily-sale/lib.ts.
import { z } from 'zod';

import { isForbidden, NetworkError, ProblemError } from '@/api/errors';
import type {
  DailySaleCreate,
  DailySaleQuoteRequest,
  Extra,
  OperationalSpot,
  Pack,
  Slots,
  TicketPaymentMethod,
} from '@/api/types';
import type { Abilities } from '@/features/permissions/permissions';
import { slotStatus, isBookable } from '@/features/day-map/status';
import type { CalendarDate } from '@/lib/calendar';
import { parseCents, type Cents } from '@/lib/money';

/** Core limits (DailySaleHolder, SimulateExtra). */
export const HOLDER_NAME_MAX = 100;

export interface SaleValues {
  date: CalendarDate;
  slots: Slots;
  spotId: string;
  packId: string;
  /** Quantity per extra id (0 = not taken). */
  extras: Record<string, number>;
  firstName: string;
  lastName: string;
  /** Cash received, in cents, to compute the change (cash only). */
  tendered?: Cents;
}

/**
 * The sale needs both bookings.write and cash.operate (createDailySale),
 * also for a card payment: cashier, manager, owner.
 */
export const canSell = (a: Pick<Abilities, 'canWriteBookings' | 'canCollectCash'>) =>
  a.canWriteBookings && a.canCollectCash;

/** True when the spot can be sold for the slot: free or a released pass day. */
export function sellableSpot(spot: OperationalSpot | undefined, slots: Slots): boolean {
  return !!spot && isBookable(slotStatus(spot, slots));
}

/**
 * Packs sellable at the desk on the spot's zone, in display order: active,
 * offered on the desk channel (or on every channel) and allowed in the zone.
 */
export function packsForSale(packs: readonly Pack[], zoneId: string): Pack[] {
  return packs
    .filter((p) => {
      if (!p.active) return false;
      if (p.channels?.length && !p.channels.includes('desk')) return false;
      const allowed = p.allowed_zone_ids ?? [];
      return allowed.length === 0 || allowed.includes(zoneId);
    })
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Active extras offered with the pack, in display order. */
export function extrasForPack(extras: readonly Extra[], packId: string): Extra[] {
  return extras
    .filter((x) => x.active && (!x.allowed_pack_ids?.length || x.allowed_pack_ids.includes(packId)))
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Quote request; null until a pack is chosen. Extras sorted for a stable key. */
export function toQuoteRequest(v: SaleValues): DailySaleQuoteRequest | null {
  if (!v.packId || !v.spotId) return null;
  const extras = Object.entries(v.extras)
    .filter(([, q]) => q > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([extra_id, quantity]) => ({ extra_id, quantity }));
  return {
    date: v.date,
    slots: v.slots,
    pack_id: v.packId,
    spot_id: v.spotId,
    ...(extras.length > 0 ? { extras } : {}),
  };
}

/**
 * Create request: the quote plus the payment, the optional name and the
 * total the operator saw (the server answers 409 price_changed if it
 * computes another one).
 */
export function toCreateRequest(
  v: SaleValues,
  method: TicketPaymentMethod,
  opts: { cashSessionId?: string; expectedTotal?: Cents } = {},
): DailySaleCreate | null {
  const quote = toQuoteRequest(v);
  if (!quote) return null;
  const first = v.firstName.trim();
  const last = v.lastName.trim();
  return {
    ...quote,
    payment: {
      method,
      ...(method === 'cash' && opts.cashSessionId ? { cash_session_id: opts.cashSessionId } : {}),
      ...(method === 'cash' && v.tendered ? { tendered_amount: v.tendered } : {}),
    },
    ...(first || last
      ? {
          holder: { ...(first ? { first_name: first } : {}), ...(last ? { last_name: last } : {}) },
        }
      : {}),
    ...(opts.expectedTotal !== undefined ? { expected_total: opts.expectedTotal } : {}),
  };
}

/** Change to give back; undefined without a tendered amount or when it is short. */
export function changeDue(total: Cents, tendered: Cents | undefined): Cents | undefined {
  if (!tendered || tendered < total) return undefined;
  return tendered - total;
}

/** Name and cash received: messages are i18n keys. */
export const saleFormSchema = z.object({
  firstName: z.string().trim().max(HOLDER_NAME_MAX, 'sale.form.nameTooLong'),
  lastName: z.string().trim().max(HOLDER_NAME_MAX, 'sale.form.nameTooLong'),
  tendered: z
    .string()
    .trim()
    .refine((s) => s === '' || parseCents(s) !== null, 'sale.form.amountInvalid'),
});

export type SaleFormValues = z.infer<typeof saleFormSchema>;

export type SaleErrorKey =
  | 'sale.errors.offline'
  | 'sale.errors.forbidden'
  | 'sale.errors.spot_unavailable'
  | 'sale.errors.cash_session_closed'
  | 'sale.errors.price_changed'
  | 'sale.errors.no_price'
  | 'sale.errors.in_progress'
  | 'sale.errors.not_found'
  | 'sale.errors.default';

/** Message of a refused sale or quote, from the core's stable problem slugs. */
export function saleErrorKey(e: unknown): SaleErrorKey {
  if (e instanceof NetworkError) return 'sale.errors.offline';
  if (isForbidden(e)) return 'sale.errors.forbidden';
  if (e instanceof ProblemError) {
    switch (e.type) {
      case 'spot_unavailable':
      case 'pool_exhausted':
      case 'agreement_quota_exceeded':
        return 'sale.errors.spot_unavailable';
      case 'cash_session_closed':
        return 'sale.errors.cash_session_closed';
      case 'price_changed':
        return 'sale.errors.price_changed';
      case 'no_price':
        return 'sale.errors.no_price';
      case 'idempotency_in_progress':
        return 'sale.errors.in_progress';
      default:
        if (e.status === 404) return 'sale.errors.not_found';
    }
  }
  return 'sale.errors.default';
}
