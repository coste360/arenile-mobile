// Waitlist (core spec 10.5; spec 03 of this app): the requests without
// availability in priority order and the manual offer of a freed spot, as
// in the panel. Reading needs bookings.read, offering bookings.write. An
// offer is a timed hold created by the server under the database
// constraints, so it is online only and never queued.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { request, type ApiClient } from '@/api/client';
import { isForbidden, NetworkError, ProblemError } from '@/api/errors';
import { useIdempotencyKeys } from '@/api/idempotency';
import { estKeys } from '@/api/query-keys';
import type {
  WaitlistEntry,
  WaitlistEntryDetail,
  WaitlistEntryStatus,
  WaitlistOffer,
  WaitlistOfferCreate,
  WaitlistSettings,
} from '@/api/types';
import type { Abilities } from '@/features/permissions/permissions';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import { isCalendarDate, type CalendarDate } from '@/lib/calendar';
import { useDependencies } from '@/providers/dependencies';

const EST = '/api/admin/v1/establishments/{establishmentId}' as const;

/** Entries listed at once: a lido's waitlist fits in one page. */
export const WAITLIST_PAGE = 100;

/** Core bounds of an offer's hold (WaitlistOfferCreate.hold_minutes). */
export const HOLD_MINUTES_MIN = 5;
export const HOLD_MINUTES_MAX = 10_080;

export const canViewWaitlist = (a: Pick<Abilities, 'canViewBookings'>) => a.canViewBookings;
export const canOfferWaitlist = (a: Pick<Abilities, 'canWriteBookings'>) => a.canWriteBookings;

/** Status filter of the list: the queue, the open offers, or every entry. */
export type WaitlistView = 'waiting' | 'offered' | 'all';
export const WAITLIST_VIEWS: readonly WaitlistView[] = ['waiting', 'offered', 'all'];

export function statusOfView(view: WaitlistView): WaitlistEntryStatus | undefined {
  return view === 'all' ? undefined : view;
}

/** A freed spot the list is opened for (from the map). */
export interface FreedSpot {
  spotId: string;
  zoneId: string;
  label: string;
  date: CalendarDate;
}

/** The freed spot carried by the route parameters, when they are all there. */
export function freedSpotOf(params: {
  spotId?: string;
  zoneId?: string;
  label?: string;
  date?: string;
}): FreedSpot | undefined {
  const { spotId, zoneId, label, date } = params;
  return spotId && zoneId && label && date && isCalendarDate(date)
    ? { spotId, zoneId, label, date }
    : undefined;
}

/** Only a waiting entry can receive an offer (offered = one already open). */
export const offerable = (e: Pick<WaitlistEntry, 'status'>) => e.status === 'waiting';

/**
 * Entries a freed spot can go to: waiting, asking for a period that
 * includes the day, in the spot's zone (or any zone) and for that spot or
 * none in particular. The server checks the rest when the offer is made.
 */
export function compatibleWith(
  entries: readonly WaitlistEntry[],
  spot: { spotId: string; zoneId: string },
  date: CalendarDate,
): WaitlistEntry[] {
  return entries.filter(
    (e) =>
      offerable(e) &&
      e.starts_on <= date &&
      e.ends_on >= date &&
      (!e.zone_id || e.zone_id === spot.zoneId) &&
      (!e.spot_id || e.spot_id === spot.spotId),
  );
}

/** Offer form: minutes of the hold, as text (message keys are i18n keys). */
export const offerSchema = z.object({
  minutes: z
    .string()
    .trim()
    .refine((s) => {
      const n = Number(s);
      return /^\d+$/.test(s) && n >= HOLD_MINUTES_MIN && n <= HOLD_MINUTES_MAX;
    }, 'waitlist.offer.minutesInvalid'),
});

export type OfferValues = z.infer<typeof offerSchema>;

export function toOfferCreate(spotId: string | undefined, minutes: string): WaitlistOfferCreate {
  return { ...(spotId ? { spot_id: spotId } : {}), hold_minutes: Number(minutes.trim()) };
}

export type OfferErrorKey =
  | 'waitlist.errors.offline'
  | 'waitlist.errors.forbidden'
  | 'waitlist.errors.disabled'
  | 'waitlist.errors.unavailable'
  | 'waitlist.errors.alreadyOffered'
  | 'waitlist.errors.invalid'
  | 'waitlist.errors.notFound'
  | 'waitlist.errors.default';

/** Message of a refused offer or list, from the core's stable problem slugs. */
export function waitlistErrorKey(e: unknown): OfferErrorKey {
  if (e instanceof NetworkError) return 'waitlist.errors.offline';
  if (isForbidden(e)) return 'waitlist.errors.forbidden';
  if (e instanceof ProblemError) {
    switch (e.type) {
      case 'waitlist_disabled':
        return 'waitlist.errors.disabled';
      case 'spot_unavailable':
      case 'pool_exhausted':
      case 'quota_exceeded':
        return 'waitlist.errors.unavailable';
      case 'conflict':
      case 'invalid_transition':
        return 'waitlist.errors.alreadyOffered';
      case 'validation_failed':
      case 'bad_request':
        return 'waitlist.errors.invalid';
      default:
        if (e.status === 404) return 'waitlist.errors.notFound';
    }
  }
  return 'waitlist.errors.default';
}

export async function fetchWaitlist(
  client: ApiClient,
  establishmentId: string,
  params: { status?: WaitlistEntryStatus; q?: string },
): Promise<WaitlistEntry[]> {
  const q = params.q?.trim();
  const page = await request(() =>
    client.GET(`${EST}/waitlist`, {
      params: {
        path: { establishmentId },
        query: {
          limit: WAITLIST_PAGE,
          ...(params.status ? { status: params.status } : {}),
          ...(q ? { q } : {}),
        },
      },
    }),
  );
  return page.items;
}

export function useWaitlist(
  params: { status?: WaitlistEntryStatus; q?: string },
  enabled: boolean,
) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery({
    queryKey: estKeys.waitlist(establishmentId, { status: params.status, q: params.q?.trim() }),
    queryFn: () => fetchWaitlist(client, establishmentId, params),
    enabled,
    staleTime: 15_000,
  });
}

/** GET waitlist/{id}: the entry and its offers, newest last. */
export function useWaitlistEntry(entryId: string | undefined, enabled: boolean) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery<WaitlistEntryDetail>({
    queryKey: estKeys.waitlistEntry(establishmentId, entryId ?? ''),
    queryFn: () =>
      request(() =>
        client.GET(`${EST}/waitlist/{entryId}`, {
          params: { path: { establishmentId, entryId: entryId as string } },
        }),
      ),
    enabled: enabled && !!entryId,
    staleTime: 15_000,
  });
}

export function useWaitlistSettings(enabled: boolean) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery<WaitlistSettings>({
    queryKey: estKeys.waitlistSettings(establishmentId),
    queryFn: () =>
      request(() =>
        client.GET(`${EST}/waitlist-settings`, { params: { path: { establishmentId } } }),
      ),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/**
 * Offers a spot to an entry now. The Idempotency-Key stays the same while
 * the request does not change, so a double tap holds and emails once; after an answer
 * (offer made or refused) the next attempt gets a new key (src/api/idempotency.ts).
 */
export function useOfferWaitlistEntry() {
  const qc = useQueryClient();
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  const { randomId } = useDependencies();
  const keys = useIdempotencyKeys(randomId);
  return useMutation<WaitlistOffer, Error, { entryId: string; body: WaitlistOfferCreate }>({
    mutationFn: ({ entryId, body }) => {
      const key = keys.keyFor(JSON.stringify([entryId, body]));
      return request(() =>
        client.POST(`${EST}/waitlist/{entryId}/offer`, {
          params: { path: { establishmentId, entryId }, header: { 'Idempotency-Key': key } },
          body,
        }),
      );
    },
    onSettled: async (_data, error) => {
      keys.settled(error);
      // The entry is now offered and the spot held: the list and the map change.
      await Promise.all([
        qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'waitlist') }),
        qc.invalidateQueries({ queryKey: estKeys.area(establishmentId, 'operations') }),
      ]);
    },
  });
}
