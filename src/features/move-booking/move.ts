// Moving a booking to another spot (core spec 11.3 "sposta"; spec 03 of this
// app). Online only, never queued (core spec 21.2): the release and the new
// allocation happen in one server transaction, guarded by the database
// constraints. The app previews the move with dry_run (conflicts, new price)
// and then applies it with If-Match on the booking version. A booking owned
// by a daily ticket moves through the ticket (its price does not change),
// as in the panel. Core 1.1 (spec 30.7): a move can start today or
// tomorrow, two bookings can swap their spots, and the user's last move or
// swap can be undone within 5 minutes.
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { request, type ApiClient } from '@/api/client';
import { isForbidden, NetworkError, ProblemError } from '@/api/errors';
import { estKeys } from '@/api/query-keys';
import type {
  BookingChangeResult,
  BookingDetail,
  BookingMoveRequest,
  BookingStatus,
  BookingSwapRequest,
  BookingSwapResult,
  LastMove,
  MoveUndoInfo,
  MoveUndoResult,
  OperationalBooking,
  OperationalSpot,
  OperationsDay,
  Slots,
} from '@/api/types';
import { isBookable, slotStatus } from '@/features/day-map/status';
import type { Abilities } from '@/features/permissions/permissions';
import { matchSpots } from '@/features/spot-blocks/spot-search';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import { addDays, type CalendarDate } from '@/lib/calendar';
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

/** When a move starts: today (the default) or tomorrow, leaving today where it is. */
export type MoveStart = 'today' | 'tomorrow';

/**
 * Starts the user can choose: today or tomorrow while the stay covers today
 * and goes on after it; none (the whole stay, or just today) otherwise.
 */
export function moveStarts(
  b: Pick<BookingDetail, 'starts_on' | 'ends_on'>,
  today: CalendarDate,
): MoveStart[] {
  return b.starts_on <= today && today < b.ends_on ? ['today', 'tomorrow'] : [];
}

/**
 * First day of the move: tomorrow when chosen, today when the stay is
 * already under way (past days keep their spot, as the panel does from the
 * map), otherwise the whole stay (undefined).
 */
export function moveFrom(
  b: Pick<BookingDetail, 'starts_on' | 'ends_on'>,
  today: CalendarDate,
  start: MoveStart = 'today',
): CalendarDate | undefined {
  if (start === 'tomorrow' && moveStarts(b, today).includes('tomorrow')) return addDays(today, 1);
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

/** A spot held by another booking that can take part in a swap. */
export type SwapCandidate = OperationalSpot & { booking: OperationalBooking & { line_id: string } };

/**
 * Bookings to swap with, by the spot they hold on the first day moved: other
 * bookings placed on a line, not daily tickets (they move through the
 * ticket), still modifiable. Filtered by label.
 */
export function swapCandidates(
  day: OperationsDay | undefined,
  bookingId: string,
  query: string,
): { spots: SwapCandidate[]; more: boolean } {
  const taken = (day?.spots ?? []).filter(
    (s): s is SwapCandidate =>
      !!s.booking &&
      s.booking.booking_id !== bookingId &&
      !!s.booking.line_id &&
      !s.booking.ticket &&
      MOVABLE_STATUSES.has(s.booking.status),
  );
  const { spots, more } = matchSpots(taken, query);
  return { spots: spots as SwapCandidate[], more };
}

/**
 * Swap request: both bookings at the version the user saw (412 otherwise),
 * from the first day moved (the server swaps the days the two stays share).
 */
export function toSwapRequest(input: {
  bookingId: string;
  lineId: string;
  version: number;
  other: Pick<SwapCandidate['booking'], 'booking_id' | 'line_id' | 'version'>;
  from: CalendarDate;
  dryRun: boolean;
}): BookingSwapRequest {
  return {
    a: { booking_id: input.bookingId, line_id: input.lineId, expected_version: input.version },
    b: {
      booking_id: input.other.booking_id,
      line_id: input.other.line_id,
      expected_version: input.other.version,
    },
    from: input.from,
    ...(input.dryRun ? { dry_run: true } : {}),
  };
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
  | 'move.errors.approval'
  | 'move.errors.concurrent'
  | 'move.errors.invalid'
  | 'move.errors.not_found'
  | 'move.swap.errors.conflict'
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
      // Core 1.1: no common day from the chosen date, or the two lines share the spot.
      case 'swap_conflict':
        return 'move.swap.errors.conflict';
      case 'invalid_transition':
      case 'ticket_voided':
        return 'move.errors.not_modifiable';
      case 'policy_violation':
        return 'move.errors.policy';
      // Core 1.1.2: the change needs the approval of a manager, which the
      // user's role cannot give.
      case 'approval_required':
        return 'move.errors.approval';
      // Core 1.1.1: another change of the same booking won the race; trying
      // again is safe (moves carry If-Match, nothing was applied).
      case 'concurrent_update':
        return 'move.errors.concurrent';
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

export type UndoErrorKey =
  | 'move.undo.errors.offline'
  | 'move.undo.errors.forbidden'
  | 'move.undo.errors.expired'
  | 'move.undo.errors.conflict'
  | 'move.undo.errors.default';

/** Message of a refused undo (core spec 30.7). */
export function undoErrorKey(e: unknown): UndoErrorKey {
  if (e instanceof NetworkError) return 'move.undo.errors.offline';
  if (isForbidden(e)) return 'move.undo.errors.forbidden';
  if (e instanceof ProblemError) {
    // 410 after the 5 minutes; 404 when the entry is gone (already undone).
    if (e.type === 'move_undo_expired' || e.status === 410 || e.status === 404) {
      return 'move.undo.errors.expired';
    }
    // The original spots were taken, or the bookings changed after the move.
    if (e.status === 409) return 'move.undo.errors.conflict';
  }
  return 'move.undo.errors.default';
}

/** The undo is still offered: before its expiry (the server checks it again). */
export function undoOpen(info: MoveUndoInfo | undefined, now: Date): info is MoveUndoInfo {
  return !!info && Date.parse(info.expires_at) > now.getTime();
}

/** The user's last undoable move, when it concerns this booking. */
export function lastMoveOf(
  last: LastMove | undefined,
  bookingId: string,
  now: Date,
): MoveUndoInfo | undefined {
  const m = last?.move;
  return undoOpen(m, now) && m.booking_ids.includes(bookingId) ? m : undefined;
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

export function swapBookings(
  client: ApiClient,
  establishmentId: string,
  body: BookingSwapRequest,
): Promise<BookingSwapResult> {
  return request(() =>
    client.POST(`${EST}/bookings/swap`, { params: { path: { establishmentId } }, body }),
  );
}

export function undoMove(
  client: ApiClient,
  establishmentId: string,
  moveId: string,
): Promise<MoveUndoResult> {
  return request(() =>
    client.POST(`${EST}/moves/{moveId}/undo`, { params: { path: { establishmentId, moveId } } }),
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

/** Preview of a swap (dry_run): both new prices and the conflicts, nothing written. */
export function useSwapPreview() {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useMutation({
    mutationFn: (body: BookingSwapRequest) => swapBookings(client, establishmentId, body),
  });
}

export type MoveTarget =
  | { kind: 'booking'; bookingId: string; body: BookingMoveRequest; version: number }
  | { kind: 'ticket'; ticketId: string; spotId: string; version: number }
  | { kind: 'swap'; body: BookingSwapRequest };

export interface MoveOutcome {
  newTotal?: Cents;
  /** Undo of the move or swap (5 minutes); absent for a ticket. */
  undo?: MoveUndoInfo;
}

/** Applies a move (booking, daily ticket or swap) and refreshes the map and the lists. */
export function useApplyMove() {
  const qc = useQueryClient();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useMutation({
    mutationFn: async (target: MoveTarget): Promise<MoveOutcome> => {
      if (target.kind === 'swap') {
        const r = await swapBookings(client, establishmentId, target.body);
        return { undo: r.undo };
      }
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
      return { newTotal: r.new_total, undo: r.undo };
    },
    onSettled: () => refreshAfterMove(qc, establishmentId),
  });
}

function refreshAfterMove(qc: QueryClient, establishmentId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'operations') }),
    qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'bookings') }),
    qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'tickets') }),
  ]);
}

/** The user's last move still undoable (online only, never persisted). */
export function useLastMove(enabled: boolean) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery({
    queryKey: estKeys.lastMove(establishmentId),
    queryFn: (): Promise<LastMove> =>
      request(() => client.GET(`${EST}/moves/last`, { params: { path: { establishmentId } } })),
    enabled,
    staleTime: 0,
  });
}

/** Undoes a move or swap within 5 minutes; refreshes the map and the lists. */
export function useUndoMove() {
  const qc = useQueryClient();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useMutation({
    mutationFn: (moveId: string) => undoMove(client, establishmentId, moveId),
    onSettled: () => refreshAfterMove(qc, establishmentId),
  });
}
