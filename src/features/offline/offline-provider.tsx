// React binding of the offline runtime: attaches it to the paired session,
// detaches it on sign-out, signs out when a replay meets a revoked token,
// and exposes hooks to the features and the connection indicator.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { useSession } from '@/features/session/session-provider';
import { createApiClient } from '@/api/client';
import { useDependencies } from '@/providers/dependencies';

import type { OfflineRuntime, OfflineStatus } from './runtime';
import type { NewOfflineOperation, OfflineOperation } from './types';

const OfflineContext = createContext<OfflineRuntime | null>(null);

export function OfflineProvider({
  runtime,
  children,
}: {
  runtime: OfflineRuntime;
  children: ReactNode;
}) {
  const { state, signOut } = useSession();
  const { fetch } = useDependencies();
  const session = state.status === 'paired' ? state.session : null;
  const reason = state.status === 'unpaired' ? state.reason : undefined;

  useEffect(() => {
    if (!session) {
      void runtime.detach(reason);
      return;
    }
    runtime.attach(
      session,
      createApiClient({
        baseUrl: session.instanceUrl,
        token: session.token,
        fingerprint: session.fingerprint,
        fetch,
      }),
    );
  }, [runtime, session, reason, fetch]);

  useEffect(() => runtime.onUnauthorized(() => void signOut('revoked')), [runtime, signOut]);
  useEffect(() => () => runtime.stop(), [runtime]);

  return <OfflineContext.Provider value={runtime}>{children}</OfflineContext.Provider>;
}

function useRuntime(): OfflineRuntime {
  const runtime = useContext(OfflineContext);
  if (!runtime) throw new Error('offline hooks outside OfflineProvider');
  return runtime;
}

/** Connection state and counts for the indicator (re-renders on change). */
export function useOfflineStatus(): OfflineStatus {
  const runtime = useRuntime();
  return useSyncExternalStore(runtime.subscribe, runtime.getStatus, runtime.getStatus);
}

/** The queued operations in send order, with the user's actions on them. */
export function useOfflineQueue(): {
  operations: readonly OfflineOperation[];
  retry(id: string): Promise<void>;
  discard(id: string): Promise<void>;
  flush(): Promise<void>;
} {
  const runtime = useRuntime();
  const operations = useSyncExternalStore(
    runtime.queue.subscribe,
    runtime.queue.getSnapshot,
    runtime.queue.getSnapshot,
  );
  const flush = useCallback(async () => {
    await runtime.flush();
  }, [runtime]);
  return useMemo(
    () => ({ operations, retry: runtime.retry, discard: runtime.discard, flush }),
    [operations, runtime, flush],
  );
}

/**
 * Queues a low-risk operation (check-in, day release, note, cash payment):
 * it is shown at once on the cached data and sent in order, now or on
 * reconnection, with a stable Idempotency-Key. Use it whether online or
 * not: online it is simply sent immediately.
 */
export function useEnqueueOperation(): (input: NewOfflineOperation) => Promise<OfflineOperation> {
  const runtime = useRuntime();
  return runtime.enqueue;
}

/**
 * For create/move booking (spec 21.2): available only while the instance
 * answers, since they need the server's availability guarantees. Never
 * queue them; show `OnlineOnlyNotice` when unavailable.
 */
export function useOnlineOnly(): { available: boolean } {
  const { connection } = useOfflineStatus();
  return { available: connection === 'online' || connection === 'syncing' };
}
