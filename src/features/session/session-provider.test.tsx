import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ProblemError, UnauthorizedError } from '@/api/errors';
import { fixedClock } from '@/lib/clock';
import { createFakeNetworkMonitor } from '@/lib/network';
import { createMemoryKeyValueStore } from '@/lib/storage';
import { DependenciesProvider, type Dependencies } from '@/providers/dependencies';
import { SESSION } from '@/test/fixtures';

import { createSessionStore, SESSION_KEY } from './session';
import { SessionProvider, useSession } from './session-provider';

function setup() {
  const kv = createMemoryKeyValueStore({ [SESSION_KEY]: JSON.stringify(SESSION) });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const deps: Dependencies = {
    kv,
    offlineStore: createMemoryKeyValueStore(),
    network: createFakeNetworkMonitor(),
    randomId: () => 'id',
    clock: fixedClock('2026-10-25T08:00:00Z'),
    device: { name: 'Test', platform: 'ios' },
    appVersion: '1.0.0',
    deviceLocales: () => ['it-IT'],
    openSystemSettings: () => {},
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={deps}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider initial={SESSION} store={createSessionStore(kv)}>
          {children}
        </SessionProvider>
      </QueryClientProvider>
    </DependenciesProvider>
  );
  return { kv, queryClient, wrapper };
}

const unauthorized = () =>
  new UnauthorizedError(401, { type: 'unauthorized', title: 'unauthorized', status: 401 });

describe('SessionProvider', () => {
  it('signs out as revoked when a query fails with 401', async () => {
    const { kv, wrapper } = setup();
    const { result } = await renderHook(
      () => {
        useQuery({ queryKey: ['x'], queryFn: () => Promise.reject(unauthorized()) });
        return useSession();
      },
      { wrapper },
    );

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'unpaired', reason: 'revoked' }),
    );
    await waitFor(() => expect(kv.snapshot()[SESSION_KEY]).toBeUndefined());
  });

  it('signs out as revoked when a mutation fails with 401', async () => {
    const { kv, wrapper } = setup();
    const { result } = await renderHook(
      () => ({
        session: useSession(),
        mutation: useMutation({ mutationFn: () => Promise.reject(unauthorized()) }),
      }),
      { wrapper },
    );

    await act(async () => {
      result.current.mutation.mutate();
    });

    await waitFor(() =>
      expect(result.current.session.state).toEqual({ status: 'unpaired', reason: 'revoked' }),
    );
    await waitFor(() => expect(kv.snapshot()[SESSION_KEY]).toBeUndefined());
  });

  it('keeps the session on other errors', async () => {
    const { kv, wrapper } = setup();
    const { result } = await renderHook(
      () => {
        const q = useQuery({
          queryKey: ['y'],
          queryFn: () => Promise.reject(new ProblemError(403, null)),
        });
        return { session: useSession(), q };
      },
      { wrapper },
    );

    await waitFor(() => expect(result.current.q.isError).toBe(true));
    expect(result.current.session.state.status).toBe('paired');
    expect(kv.snapshot()[SESSION_KEY]).toBeDefined();
  });
});
