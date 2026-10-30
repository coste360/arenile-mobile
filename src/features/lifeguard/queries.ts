// Lifeguard list of a day (core spec 30.10). Today and tomorrow are kept
// for offline consultation (spec 21.2, prefetched and persisted like the
// operations day); other days are online only (ADR 0014).
import { useQuery } from '@tanstack/react-query';

import { request, type ApiClient } from '@/api/client';
import { UnexpectedResponseError } from '@/api/errors';
import { estKeys } from '@/api/query-keys';
import type { LifeguardList, Slots } from '@/api/types';
import { DAY_STALE_MS } from '@/features/operations/queries';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import type { CalendarDate } from '@/lib/calendar';

export async function fetchLifeguardList(
  client: ApiClient,
  establishmentId: string,
  date: CalendarDate,
  slot: Slots = 'FULL',
): Promise<LifeguardList> {
  // The contract also lists the printable HTML of the same operation; the
  // app asks for JSON only, anything else is an unexpected answer.
  const list = await request(() =>
    client.GET('/api/admin/v1/establishments/{establishmentId}/operations/lifeguard-list', {
      params: { path: { establishmentId }, query: { date, slot, format: 'json' } },
    }),
  );
  if (typeof list !== 'object' || list === null) throw new UnexpectedResponseError(200);
  return list;
}

export const lifeguardListQuery = (
  client: ApiClient,
  establishmentId: string,
  date: CalendarDate,
  slot: Slots = 'FULL',
) => ({
  queryKey: estKeys.lifeguardList(establishmentId, date, slot),
  queryFn: () => fetchLifeguardList(client, establishmentId, date, slot),
  staleTime: DAY_STALE_MS,
});

/** GET operations/lifeguard-list for a day of the paired establishment. */
export function useLifeguardList(date: CalendarDate) {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery(lifeguardListQuery(client, establishmentId, date));
}
