// Maps of the paired establishment (core spec 11): the list and the full
// documents (spots and decorations) the operational map draws. Configured in
// the panel; they change rarely, so they stay fresh for five minutes.
import { useQuery } from '@tanstack/react-query';

import { request, type ApiClient } from '@/api/client';
import { estKeys } from '@/api/query-keys';
import type { BeachMap, MapDocument } from '@/api/types';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';

export const MAPS_STALE_MS = 5 * 60_000;

/** Every map of the establishment, in display order (sort_order). */
export async function fetchMaps(client: ApiClient, establishmentId: string): Promise<BeachMap[]> {
  const res = await request(() =>
    client.GET('/api/admin/v1/establishments/{establishmentId}/maps', {
      params: { path: { establishmentId }, query: { limit: 200 } },
    }),
  );
  return [...res.items].sort((a, b) => a.sort_order - b.sort_order);
}

export const mapsQuery = (client: ApiClient, establishmentId: string) => ({
  queryKey: estKeys.maps(establishmentId),
  queryFn: () => fetchMaps(client, establishmentId),
  staleTime: MAPS_STALE_MS,
});

export function useMaps() {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery(mapsQuery(client, establishmentId));
}

export function fetchMapDocument(
  client: ApiClient,
  establishmentId: string,
  mapId: string,
): Promise<MapDocument> {
  return request(() =>
    client.GET('/api/admin/v1/establishments/{establishmentId}/maps/{mapId}', {
      params: { path: { establishmentId, mapId } },
    }),
  );
}

export const mapDocumentQuery = (client: ApiClient, establishmentId: string, mapId: string) => ({
  queryKey: estKeys.map(establishmentId, mapId),
  queryFn: () => fetchMapDocument(client, establishmentId, mapId),
  staleTime: MAPS_STALE_MS,
});

export function useMapDocument(mapId: string) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery(mapDocumentQuery(client, establishmentId, mapId));
}
