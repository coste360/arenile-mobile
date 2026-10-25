// Session state of the app: unpaired, or paired with one instance. Any 401
// from the instance (token revoked from the panel, or idle for 90 days, core
// ADR 0015) clears the session and sends the user back to "Collega" with an
// explanation; the layouts redirect on the state, screens never do it by hand.
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { createApiClient, type ApiClient } from '@/api/client';
import { isUnauthorized } from '@/api/errors';
import { useDependencies } from '@/providers/dependencies';
import { errorKind } from '@/lib/log';

import type { Session, SessionStore } from './session';

export type SignOutReason = 'revoked' | 'unpaired';

export type SessionState =
  { status: 'unpaired'; reason?: SignOutReason } | { status: 'paired'; session: Session };

interface SessionContextValue {
  state: SessionState;
  /** Persists a new session (after pairing). Rejects when the keychain fails. */
  signIn(session: Session): Promise<void>;
  /** Forgets the session and every cached server response. */
  signOut(reason: SignOutReason): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  initial,
  store,
  children,
}: {
  initial: Session | null;
  store: SessionStore;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>(
    initial ? { status: 'paired', session: initial } : { status: 'unpaired' },
  );

  const signIn = useCallback(
    async (session: Session) => {
      await store.save(session);
      queryClient.clear();
      setState({ status: 'paired', session });
    },
    [store, queryClient],
  );

  const signOut = useCallback(
    async (reason: SignOutReason) => {
      setState({ status: 'unpaired', reason });
      queryClient.clear();
      try {
        await store.clear();
      } catch (e) {
        console.warn('session: keychain entry not removed', errorKind(e));
      }
    },
    [store, queryClient],
  );

  // A revoked or expired token surfaces as a 401 on any query or mutation.
  useEffect(() => {
    if (state.status !== 'paired') return;
    const onError = (error: unknown) => {
      if (isUnauthorized(error)) void signOut('revoked');
    };
    const unsubQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') onError(event.action.error);
    });
    const unsubMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') onError(event.action.error);
    });
    return () => {
      unsubQueries();
      unsubMutations();
    };
  }, [state.status, queryClient, signOut]);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}

/** The paired session; only for screens under the (connected) layout. */
export function usePairedSession(): Session {
  const { state } = useSession();
  if (state.status !== 'paired') throw new Error('usePairedSession without a paired session');
  return state.session;
}

/** API client of the paired instance (the single factory, src/api/client.ts). */
export function useApiClient(): ApiClient {
  const session = usePairedSession();
  const { fetch, pinnedFetch } = useDependencies();
  return useMemo(
    () =>
      createApiClient({
        baseUrl: session.instanceUrl,
        token: session.token,
        fingerprint: session.fingerprint,
        fetch,
        pinnedFetch,
      }),
    [session.instanceUrl, session.token, session.fingerprint, fetch, pinnedFetch],
  );
}
