// Warm-up of what the staff need offline (spec 21.2): the maps, the day and
// the lifeguard list of today and tomorrow, fetched while the instance answers, under the same
// query keys as the screens, so the screens and the persisted cache share
// them. Failures are ignored: what is not fetched is simply not cached.
import type { QueryClient } from '@tanstack/react-query';

import { request, type ApiClient } from '@/api/client';
import type { Establishment } from '@/api/types';
import { meQuery } from '@/features/auth/queries';
import { bookingsOfDayQuery } from '@/features/bookings/queries';
import { lifeguardListQuery } from '@/features/lifeguard/queries';
import { mapDocumentQuery, mapsQuery } from '@/features/maps/queries';
import { operationsDayQuery } from '@/features/operations/queries';
import { queryKeys } from '@/features/session/queries';
import type { Session } from '@/features/session/session';
import { operationalDays } from '@/lib/calendar';

const ESTABLISHMENT_STALE_MS = 5 * 60_000;

export async function prefetchOfflineWindow(
  qc: QueryClient,
  client: ApiClient,
  session: Pick<Session, 'establishmentId' | 'deviceId'>,
  now: Date,
): Promise<void> {
  const { establishmentId } = session;
  const establishment = await qc.fetchQuery<Establishment>({
    queryKey: queryKeys.establishment(establishmentId),
    queryFn: () =>
      request(() =>
        client.GET('/api/admin/v1/establishments/{establishmentId}', {
          params: { path: { establishmentId } },
        }),
      ),
    staleTime: ESTABLISHMENT_STALE_MS,
  });
  const { today, tomorrow } = operationalDays(establishment.timezone, now);
  const ignore = () => undefined;
  const maps = qc
    .fetchQuery(mapsQuery(client, establishmentId))
    .then(
      (list) =>
        Promise.all(
          list.map((m) => qc.prefetchQuery(mapDocumentQuery(client, establishmentId, m.id))),
        ),
      ignore,
    );
  await Promise.all([
    maps,
    qc.prefetchQuery(meQuery(client, session.deviceId)),
    ...[today, tomorrow].flatMap((date) => [
      qc.prefetchQuery(operationsDayQuery(client, establishmentId, date)),
      qc.prefetchQuery(bookingsOfDayQuery(client, establishmentId, date)),
      qc.prefetchQuery(lifeguardListQuery(client, establishmentId, date)),
    ]),
  ]);
}
