// Availability of a stay for "Disponibilità" (GET availability, core spec 7.8).
// Online only and never persisted: it answers a question at the desk, and a
// booking from it still goes through the server's checks (ADR 0009).
import { useQuery } from '@tanstack/react-query';

import { request } from '@/api/client';
import { estKeys } from '@/api/query-keys';
import type { AvailabilityResult, Slots, Zone } from '@/api/types';
import { MAPS_STALE_MS } from '@/features/maps/queries';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import type { CalendarDate } from '@/lib/calendar';

export interface AvailabilityParams {
  from: CalendarDate;
  to: CalendarDate;
  slots: Slots;
  mapId: string;
}

/** Free spots of the stay on one map; null params = nothing to ask yet. */
export function useAvailability(params: AvailabilityParams | null) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery<AvailabilityResult>({
    queryKey: estKeys.availability(establishmentId, params as AvailabilityParams),
    // A question overtaken by newer dates is cancelled (TanStack aborts the signal).
    queryFn: ({ signal }) =>
      request(() =>
        client.GET('/api/admin/v1/establishments/{establishmentId}/availability', {
          params: {
            path: { establishmentId },
            query: {
              from: params!.from,
              to: params!.to,
              slots: params!.slots,
              map_id: params!.mapId,
            },
          },
          signal,
        }),
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
 * Every zone of the establishment, for the names of the zone cards; zones by
 * quantity have no map, so the list is not filtered by map. Optional: the
 * cards fall back to the zone code while it loads or if it is refused.
 */
export function useZones() {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery<Zone[]>({
    queryKey: estKeys.zones(establishmentId),
    queryFn: async () => {
      const res = await request(() =>
        client.GET('/api/admin/v1/establishments/{establishmentId}/zones', {
          params: { path: { establishmentId }, query: { limit: 200 } },
        }),
      );
      return res.items;
    },
    staleTime: MAPS_STALE_MS,
    retry: false,
  });
}
