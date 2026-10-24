// Server state of the paired instance (TanStack Query on the generated client).
import { useMutation, useQuery } from '@tanstack/react-query';

import { request } from '@/api/client';
import { isUnauthorized } from '@/api/errors';

import { useApiClient, usePairedSession, useSession } from './session-provider';

export const queryKeys = {
  self: (deviceId: string) => ['device', 'self', deviceId] as const,
  meta: (instanceUrl: string) => ['instance', 'meta', instanceUrl] as const,
  establishment: (id: string) => ['establishment', id] as const,
};

/** GET /api/device/v1/self: validates the token (401 signs out, see SessionProvider). */
export function useCurrentDevice() {
  const client = useApiClient();
  const session = usePairedSession();
  return useQuery({
    queryKey: queryKeys.self(session.deviceId),
    queryFn: () => request(() => client.GET('/api/device/v1/self')),
    staleTime: 60_000,
  });
}

/** GET /api/admin/v1/meta: version and compatibility of the instance. */
export function useInstanceMeta() {
  const client = useApiClient();
  const session = usePairedSession();
  return useQuery({
    queryKey: queryKeys.meta(session.instanceUrl),
    queryFn: () => request(() => client.GET('/api/admin/v1/meta')),
    staleTime: 5 * 60_000,
  });
}

/** The establishment the token is bound to (its current name). */
export function useEstablishment() {
  const client = useApiClient();
  const session = usePairedSession();
  return useQuery({
    queryKey: queryKeys.establishment(session.establishmentId),
    queryFn: () =>
      request(() =>
        client.GET('/api/admin/v1/establishments/{establishmentId}', {
          params: { path: { establishmentId: session.establishmentId } },
        }),
      ),
    staleTime: 5 * 60_000,
  });
}

/**
 * DELETE /api/device/v1/self, then forget the session. A 401 means the token
 * is already revoked: the outcome is the same. Network failures are returned
 * to the caller, which can offer to forget the session on this device only.
 */
export function useUnpair() {
  const client = useApiClient();
  const { signOut } = useSession();
  return useMutation({
    mutationFn: async () => {
      try {
        await request(() => client.DELETE('/api/device/v1/self'));
      } catch (e) {
        if (!isUnauthorized(e)) throw e;
      }
    },
    onSuccess: () => signOut('unpaired'),
  });
}
