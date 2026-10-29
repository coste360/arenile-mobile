// Moving a booking to another spot (core spec 11.3 "sposta"; spec 03 of this
// app). Online only, never queued (core spec 21.2): the release and the new
// allocation happen in one server transaction, guarded by the database
// constraints. The app previews the move with dry_run (conflicts, new price)
// and then applies it with If-Match on the booking version. A booking owned
// by a daily ticket moves through the ticket (its price does not change),
// as in the panel.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { request, type ApiClient } from '@/api/client';
import { isForbidden, NetworkError, ProblemError } from '@/api/errors';
import { estKeys } from '@/api/query-keys';
import type {
  BookingChangeResult,
  BookingDetail,
  BookingMoveRequest,
  BookingStatus,
  OperationalSpot,
  OperationsDay,
  Slots,
} from '@/api/types';
import { isBookable, slotStatus } from '@/features/day-map/status';
import type { Abilities } from '@/features/permissions/permissions';
import { matchSpots } from '@/features/spot-blocks/spot-search';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import type { CalendarDate } from '@/lib/calendar';
import type { Cents } from '@/lib/money';

const EST = '/api/admin/v1/establishments/{establishmentId}' as const;

/** Statuses the core lets the desk modify (booking.modifiable). */
export const MOVABLE_STATUSES: ReadonlySet<BookingStatus> = new Set([
  'draft',
  'held',
  'pending_payment',
  'awaiting_approval',
  'confirmed',
  'checked_in',
]);

/** Moving needs bookings.write (booking.Service.Move): cashier, manager, owner. */
export const canMove = (a: Pick<Abilities, 'canWriteBookings'>) => a.canWriteBookings;

/** A booking can be moved while modifiable and not over yet. */
export function movable(
  b: Pick<BookingDetail, 'status' | 'ends_on'>,
  today: CalendarDate,
): boolean {
  return MOVABLE_STATUSES.has(b.status) && b.ends_on >= today;
}

/** Lines placed on a spot, the ones a move applies to. */
export function movableLines(b: Pick<BookingDetail, 'lines'>): BookingDetail['lines'] {
  return b.lines.filter((l) => !!l.spot_id);
}

/**
 * Spot a line holds on a day: the segment covering it when the stay is split
 * across spots (core 1.1, spec 30.6; `spot_id` is the first segment's),
 * otherwise the line's spot.
 */
export function lineSpotOn(
  line: Pick<BookingDetail['lines'][number], 'spot_id' | 'spot_label' | 'segments'>,
  day: CalendarDate,
): { spotId?: string; label?: string } {
  const s = line.segments?.find((seg) => seg.starts_on <= day && day <= seg.ends_on);
  return s
    ? { spotId: s.spot_id, label: s.spot_label }
    : { spotId: line.spot_id, label: line.spot_label };
}

/**
 * Spots a move from `day` frees, in order: every segment still to come of a
 * split stay (a move with `from` takes all the following days), otherwise
 * the line's spot. Labels may be missing (unassigned).
 */
export function lineSpotsFrom(
  line: Pick<BookingDetail['lines'][number], 'spot_label' | 'segments'>,
  day: CalendarDate,
): (string | undefined)[] {
  const later = (line.segments ?? []).filter((seg) => seg.ends_on >= day);
  return later.length > 1 ? later.map((seg) => seg.spot_label) : [lineSpotOn(line, day).label];
}

/**
 * First day of the move: today when the stay is already under way (past
 * days keep their spot, as the panel does from the map), otherwise the
 * whole stay (undefined).
 */
export function moveFrom(
  b: Pick<BookingDetail, 'starts_on' | 'ends_on'>,
  today: CalendarDate,
): CalendarDate | undefined {
  return today > b.starts_on && today <= b.ends_on ? today : undefined;
}

/** Day whose free spots are offered: the first day moved. */
export function targetDay(b: Pick<BookingDetail, 'starts_on'>, from?: CalendarDate): CalendarDate {
  return from ?? b.starts_on;
}

/**
 * Spots free for the booking's slots on the first day moved, the current
 * one left out, filtered by label. The server checks every other day of the
 * stay (dry run conflicts).
 */
export function targetSpots(
  day: OperationsDay | undefined,
  slots: Slots,
  currentSpotId: string | undefined,
  query: string,
): { spots: OperationalSpot[]; more: boolean } {
  const free = (day?.spots ?? []).filter(
    (s) => s.spot_id !== currentSpotId && isBookable(slotStatus(s, slots)),
  );
  return matchSpots(free, query);
}

export function toMoveRequest(input: {
  lineId: string;
  spotId: string;
  from?: CalendarDate;
  dryRun: boolean;
}): BookingMoveRequest {
  return {
    line_id: input.lineId,
    spot_id: input.spotId,
    ...(input.from ? { from: input.from } : {}),
    ...(input.dryRun ? { dry_run: true } : {}),
  };
}

export type PriceChange = 'same' | 'up' | 'down';

export function priceChange(r: Pick<BookingChangeResult, 'price_difference'>): PriceChange {
  if (r.price_difference > 0) return 'up';
  if (r.price_difference < 0) return 'down';
  return 'same';
}

export type MoveErrorKey =
  | 'move.errors.offline'
  | 'move.errors.forbidden'
  | 'move.errors.spot_unavailable'
  | 'move.errors.version_conflict'
  | 'move.errors.not_modifiable'
  | 'move.errors.policy'
  | 'move.errors.invalid'
  | 'move.errors.not_found'
  | 'move.errors.default';

/** Message of a refused move, from the core's stable problem slugs. */
export function moveErrorKey(e: unknown): MoveErrorKey {
  if (e instanceof NetworkError) return 'move.errors.offline';
  if (isForbidden(e)) return 'move.errors.forbidden';
  if (e instanceof ProblemError) {
    switch (e.type) {
      case 'spot_unavailable':
      case 'pool_exhausted':
      case 'assignment_conflict':
      // Core 1.1: the spots reserved to the booking's agreement are used up.
      case 'agreement_quota_exceeded':
        return 'move.errors.spot_unavailable';
      case 'version_conflict':
        return 'move.errors.version_conflict';
      case 'invalid_transition':
      case 'ticket_voided':
        return 'move.errors.not_modifiable';
      case 'policy_violation':
        return 'move.errors.policy';
      case 'validation_failed':
      case 'bad_request':
        return 'move.errors.invalid';
      default:
        if (e.status === 404) return 'move.errors.not_found';
        if (e.status === 409 && e.type === 'conflict') return 'move.errors.not_modifiable';
    }
  }
  return 'move.errors.default';
}

export function moveBooking(
  client: ApiClient,
  establishmentId: string,
  bookingId: string,
  body: BookingMoveRequest,
  version: number,
): Promise<BookingChangeResult> {
  return request(() =>
    client.POST(`${EST}/bookings/{bookingId}/move`, {
      params: { path: { establishmentId, bookingId }, header: { 'If-Match': `"${version}"` } },
      body,
    }),
  );
}

export async function moveTicket(
  client: ApiClient,
  establishmentId: string,
  ticketId: string,
  spotId: string,
  version: number,
): Promise<void> {
  await request(() =>
    client.POST(`${EST}/tickets/{ticketId}/move`, {
      params: { path: { establishmentId, ticketId }, header: { 'If-Match': `"${version}"` } },
      body: { spot_id: spotId },
    }),
  );
}

/** Preview of a move (dry_run): conflicts and the new price, nothing written. */
export function useMovePreview() {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useMutation({
    mutationFn: (v: { bookingId: string; body: BookingMoveRequest; version: number }) =>
      moveBooking(client, establishmentId, v.bookingId, v.body, v.version),
  });
}

export type MoveTarget =
  | { kind: 'booking'; bookingId: string; body: BookingMoveRequest; version: number }
  | { kind: 'ticket'; ticketId: string; spotId: string; version: number };

/** Applies a move (booking or daily ticket) and refreshes the map and the lists. */
export function useApplyMove() {
  const qc = useQueryClient();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useMutation({
    mutationFn: async (target: MoveTarget): Promise<{ newTotal?: Cents }> => {
      if (target.kind === 'ticket') {
        await moveTicket(client, establishmentId, target.ticketId, target.spotId, target.version);
        return {};
      }
      const r = await moveBooking(
        client,
        establishmentId,
        target.bookingId,
        target.body,
        target.version,
      );
      return { newTotal: r.new_total };
    },
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'operations') }),
        qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'bookings') }),
        qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'tickets') }),
      ]);
    },
  });
}
