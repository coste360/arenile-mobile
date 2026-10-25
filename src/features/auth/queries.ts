// The principal behind the device token: the pairing user, their
// memberships and the permissions the server grants (core spec 16).
import { useQuery } from '@tanstack/react-query';

import { request, type ApiClient } from '@/api/client';
import { authKeys } from '@/api/query-keys';
import type { Me } from '@/api/types';
import { useApiClient, usePairedSession } from '@/features/session/session-provider';

export const ME_STALE_MS = 5 * 60_000;

export function fetchMe(client: ApiClient): Promise<Me> {
  return request(() => client.GET('/api/admin/v1/auth/me'));
}

export const meQuery = (client: ApiClient, deviceId: string) => ({
  queryKey: authKeys.me(deviceId),
  queryFn: () => fetchMe(client),
  staleTime: ME_STALE_MS,
});

/** GET /api/admin/v1/auth/me: memberships and permissions of the pairing user. */
export function useMe() {
  const client = useApiClient();
  const { deviceId } = usePairedSession();
  return useQuery(meQuery(client, deviceId));
}
