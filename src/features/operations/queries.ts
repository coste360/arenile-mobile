// Operational day of the establishment (core spec 11.3 and 15.1): status of
// every spot, booking summaries, pools and totals. Feeds the map, "Oggi" and
// the spot sheet; cached for today and tomorrow (offline, spec 21.2).
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { request, type ApiClient } from '@/api/client';
import { estKeys } from '@/api/query-keys';
import type { OperationsDay, Slots } from '@/api/types';
import { useEstablishment } from '@/features/session/queries';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';
import { operationalDays, type CalendarDate } from '@/lib/calendar';
import { useDependencies } from '@/providers/dependencies';

/** Day data changes all the time at the desk; refetched after a minute. */
export const DAY_STALE_MS = 60_000;

export function fetchOperationsDay(
  client: ApiClient,
  establishmentId: string,
  date: CalendarDate,
  slot: Slots = 'FULL',
): Promise<OperationsDay> {
  return request(() =>
    client.GET('/api/admin/v1/establishments/{establishmentId}/operations/day', {
      params: { path: { establishmentId }, query: { date, slot } },
    }),
  );
}

export const operationsDayQuery = (
  client: ApiClient,
  establishmentId: string,
  date: CalendarDate,
  slot: Slots = 'FULL',
) => ({
  queryKey: estKeys.operationsDay(establishmentId, date, slot),
  queryFn: () => fetchOperationsDay(client, establishmentId, date, slot),
  staleTime: DAY_STALE_MS,
});

/** GET operations/day for one day and slot of the paired establishment. */
export function useOperationsDay(date: CalendarDate, slot: Slots = 'FULL') {
  const client = useApiClient();
  const { establishmentId } = usePairedSession();
  return useQuery(operationsDayQuery(client, establishmentId, date, slot));
}

/** Prefetches a day into the cache (offline window, pull to refresh). */
export function prefetchOperationsDay(
  queryClient: QueryClient,
  client: ApiClient,
  establishmentId: string,
  date: CalendarDate,
) {
  return queryClient.prefetchQuery(operationsDayQuery(client, establishmentId, date));
}

export interface OperationalDays {
  today: CalendarDate;
  tomorrow: CalendarDate;
  /** IANA zone of the establishment; undefined until it is known (UTC meanwhile). */
  timeZone: string | undefined;
}

/**
 * Today and tomorrow in the establishment time zone (from the cached
 * establishment, so it works offline), from the injected clock. Recomputed
 * every minute and when the app returns to the foreground, so the day rolls
 * over at the establishment's midnight.
 */
export function useOperationalDays(): OperationalDays {
  const { clock } = useDependencies();
  const establishment = useEstablishment();
  const timeZone = establishment.data?.timezone;
  const [, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const timer = setInterval(bump, 60_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') bump();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  return { ...operationalDays(timeZone, clock.now()), timeZone };
}
