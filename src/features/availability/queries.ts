// Availability of a stay for "Disponibilità" (GET availability, core spec 7.8).
// One request for the selected map (its spots and zones, map_id) and one
// small request per zone without a map (quantity zones, zone_id): with map_id
// the core leaves those out. Online only and never persisted: it answers a
// question at the desk, and a booking from it still goes through the server's
// checks (ADR 0009).
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';

import { request, type ApiClient } from '@/api/client';
import { estKeys } from '@/api/query-keys';
import type { AvailabilityResult, Slots, Zone } from '@/api/types';
import { MAPS_STALE_MS } from '@/features/maps/queries';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import type { CalendarDate } from '@/lib/calendar';

export interface StayParams {
  from: CalendarDate;
  to: CalendarDate;
  slots: Slots;
}

export interface AvailabilityParams extends StayParams {
  mapId: string;
}

function fetchAvailability(
  client: ApiClient,
  establishmentId: string,
  query: StayParams & { map_id?: string; zone_id?: string },
  signal: AbortSignal,
): Promise<AvailabilityResult> {
  return request(() =>
    client.GET('/api/admin/v1/establishments/{establishmentId}/availability', {
      params: { path: { establishmentId }, query },
      signal,
    }),
  );
}

/** Free spots and zones of the stay on one map; null params = nothing to ask yet. */
export function useAvailability(params: AvailabilityParams | null) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery<AvailabilityResult>({
    queryKey: estKeys.availability(establishmentId, params as AvailabilityParams),
    // A question overtaken by newer dates is cancelled (TanStack aborts the signal).
    queryFn: ({ signal }) =>
      fetchAvailability(
        client,
        establishmentId,
        { from: params!.from, to: params!.to, slots: params!.slots, map_id: params!.mapId },
        signal,
      ),
    enabled: !!params,
    // New dates keep the previous answer on screen (marked stale); another map starts empty.
    placeholderData: (previous, previousQuery) =>
      previous && sameMap(previousQuery?.queryKey, params?.mapId) ? previous : undefined,
    retry: false,
    staleTime: 0,
  });
}

const sameMap = (key: readonly unknown[] | undefined, mapId: string | undefined) =>
  !!mapId && (key?.[4] as Partial<AvailabilityParams> | undefined)?.mapId === mapId;

/**
 * Availability of each zone without a map (`zoneIds`, from the zones list)
 * for the stay, one request each: they belong to every map. The zones of the
 * answers together, whether any answer is an older stay's, any error.
 */
export function useMaplessZones(params: StayParams | null, zoneIds: readonly string[]) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQueries({
    queries: zoneIds.map((zoneId) => ({
      queryKey: estKeys.availability(establishmentId, { ...(params as StayParams), zoneId }),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchAvailability(
          client,
          establishmentId,
          { from: params!.from, to: params!.to, slots: params!.slots, zone_id: zoneId },
          signal,
        ),
      enabled: !!params,
      placeholderData: keepPreviousData,
      retry: false,
      staleTime: 0,
    })),
    combine: (results) => ({
      zones: results.flatMap((r, i) =>
        (r.data?.zones ?? []).filter((z) => z.zone_id === zoneIds[i]),
      ),
      stale: results.some((r) => r.isPlaceholderData),
      pending: results.some((r) => r.isPending && r.fetchStatus !== 'idle'),
      error: results.find((r) => r.error)?.error ?? null,
      refetch: () => results.forEach((r) => void r.refetch()),
    }),
  });
}

/**
 * Every zone of the establishment, for the names and the maps of the zone
 * cards; zones by quantity have no map, so the list is not filtered by map.
 * Same permission as the maps. All the pages (next_cursor), 200 at a time.
 */
export function useZones() {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery<Zone[]>({
    queryKey: estKeys.zones(establishmentId),
    queryFn: async () => {
      const zones: Zone[] = [];
      let cursor: string | undefined;
      do {
        const res = await request(() =>
          client.GET('/api/admin/v1/establishments/{establishmentId}/zones', {
            params: { path: { establishmentId }, query: { limit: 200, cursor } },
          }),
        );
        zones.push(...res.items);
        cursor = res.next_cursor || undefined;
      } while (cursor);
      return zones;
    },
    staleTime: MAPS_STALE_MS,
    retry: false,
  });
}
