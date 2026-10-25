import { onlineManager, QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';

import { createApiClient } from '@/api/client';
import { estKeys } from '@/api/query-keys';
import type { OperationsDay } from '@/api/types';
import { createFakeNetworkMonitor } from '@/lib/network';
import { createMemoryKeyValueStore } from '@/lib/storage';
import { fakeFetch, json, networkDown, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { EST_ID, operationsDay } from '@/test/operations-fixtures';
import { sequentialIds } from '@/test/ids';

import { CACHE_KEY } from './persist';
import { QUEUE_KEY } from './queue';
import { createOfflineRuntime, type OfflineRuntime } from './runtime';
import type { NewOfflineOperation } from './types';

const EST = `/api/admin/v1/establishments/${EST_ID}`;
const CHECK_IN = `POST ${EST}/bookings/b-1/check-in`;
const NOTE = `POST ${EST}/bookings/b-1/notes`;

const checkIn: NewOfflineOperation = { kind: 'check_in', bookingId: 'b-1', label: 'A1 · AR-7K3Q9' };
const note: NewOfflineOperation = {
  kind: 'note',
  bookingId: 'b-1',
  text: 'Lettino in più',
  label: 'A1 · AR-7K3Q9',
};

/** The operations sent (the warm-up of the offline window also reads data). */
const posts = (api: { calls: Request[] }) => api.calls.filter((r) => r.method === 'POST');

const runtimes: OfflineRuntime[] = [];
const clients: QueryClient[] = [];

function setup({
  routes = {},
  connected = true,
  store = createMemoryKeyValueStore(),
  idPrefix = 'id',
}: {
  routes?: Record<string, Handler>;
  connected?: boolean;
  store?: ReturnType<typeof createMemoryKeyValueStore>;
  idPrefix?: string;
} = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const network = createFakeNetworkMonitor(connected);
  const api = fakeFetch(routes);
  const runtime = createOfflineRuntime({
    queryClient,
    store,
    network,
    now: () => new Date('2026-10-25T08:00:00Z'),
    newId: sequentialIds(idPrefix),
  });
  const client = createApiClient({
    baseUrl: SESSION.instanceUrl,
    token: SESSION.token,
    fetch: api.fetch,
  });
  runtimes.push(runtime);
  clients.push(queryClient);
  return { runtime, queryClient, network, api, client, store };
}

async function attached(options: Parameters<typeof setup>[0] = {}) {
  const s = setup(options);
  await s.runtime.boot(SESSION);
  s.runtime.attach(SESSION, s.client);
  await waitFor(() => expect(s.runtime.getStatus().connection).not.toBe('syncing'));
  return s;
}

afterEach(() => {
  for (const r of runtimes.splice(0)) r.stop();
  for (const c of clients.splice(0)) c.clear();
});

describe('offline runtime', () => {
  it('queues while offline and replays in order on reconnection', async () => {
    const { runtime, network, api } = await attached({
      connected: false,
      routes: { [CHECK_IN]: () => json(200, {}), [NOTE]: () => json(200, {}) },
    });
    expect(runtime.getStatus().connection).toBe('offline');

    const a = await runtime.enqueue(checkIn);
    const b = await runtime.enqueue(note);
    expect(posts(api)).toHaveLength(0);
    expect(runtime.getStatus()).toMatchObject({ connection: 'offline', pending: 2 });

    network.set(true);

    await waitFor(() => expect(runtime.getStatus().pending).toBe(0));
    expect(posts(api).map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      CHECK_IN,
      NOTE,
    ]);
    expect(posts(api).map((r) => r.headers.get('Idempotency-Key'))).toEqual([
      a.idempotencyKey,
      b.idempotencyKey,
    ]);
    expect(runtime.getStatus().connection).toBe('online');
  });

  it('sends at once when online', async () => {
    const { runtime, api } = await attached({ routes: { [NOTE]: () => json(200, {}) } });
    await runtime.enqueue(note);
    await waitFor(() => expect(posts(api)).toHaveLength(1));
    await waitFor(() => expect(runtime.getStatus().pending).toBe(0));
  });

  it('shows the instance as unreachable when the device is connected but requests fail', async () => {
    let down = true;
    const { runtime, api } = await attached({
      routes: { [NOTE]: (r) => (down ? networkDown(r) : json(200, {})) },
    });
    await runtime.enqueue(note);
    await waitFor(() => expect(runtime.getStatus().connection).toBe('unreachable'));
    expect(runtime.getStatus().pending).toBe(1);

    down = false;
    await runtime.flush();
    expect(runtime.getStatus()).toMatchObject({ connection: 'online', pending: 0 });
    // The same key both times: the server applies the note once.
    expect(new Set(posts(api).map((r) => r.headers.get('Idempotency-Key'))).size).toBe(1);
  });

  it('surfaces a conflict to the user and keeps it until they decide', async () => {
    const { runtime } = await attached({
      routes: { [CHECK_IN]: () => problem(409, 'invalid_transition') },
    });
    const flushed = jest.fn();
    runtime.onFlushed(flushed);

    const op = await runtime.enqueue(checkIn);

    await waitFor(() => expect(runtime.getStatus().conflicts).toBe(1));
    expect(flushed).toHaveBeenCalledWith(expect.objectContaining({ conflicts: 1 }));
    expect(runtime.queue.getSnapshot()[0]).toMatchObject({
      status: 'conflict',
      error: { status: 409, type: 'invalid_transition' },
    });
    await runtime.discard(op.id);
    expect(runtime.getStatus().conflicts).toBe(0);
  });

  it('reports a revoked token and pauses the queue', async () => {
    const { runtime } = await attached({
      routes: { [NOTE]: () => problem(401, 'unauthorized') },
    });
    const unauthorized = jest.fn();
    runtime.onUnauthorized(unauthorized);
    await runtime.enqueue(note);
    await waitFor(() => expect(unauthorized).toHaveBeenCalled());
    expect(runtime.getStatus()).toMatchObject({ paused: true, pending: 1 });
  });

  it('replays the queue after a restart of the app', async () => {
    const store = createMemoryKeyValueStore();
    const before = await attached({ connected: false, store });
    const op = await before.runtime.enqueue(note);
    before.runtime.stop();

    const after = await attached({
      store,
      idPrefix: 'after',
      routes: { [NOTE]: () => json(200, {}) },
    });
    await waitFor(() => expect(posts(after.api)).toHaveLength(1));
    expect(posts(after.api)[0]!.headers.get('Idempotency-Key')).toBe(op.idempotencyKey);
    await waitFor(() => expect(JSON.parse(store.snapshot()[QUEUE_KEY]!)).toEqual([]));
  });

  it('shows a queued check-in on the cached day at once', async () => {
    const { runtime, queryClient } = await attached({ connected: false });
    queryClient.setQueryData(estKeys.operationsDay(EST_ID, '2026-10-25'), operationsDay());
    await runtime.enqueue(checkIn);
    const day = queryClient.getQueryData<OperationsDay>(
      estKeys.operationsDay(EST_ID, '2026-10-25'),
    );
    expect(day!.spots[0]!.status).toBe('checked_in');
  });

  it('keeps the read version on a check-in only when nothing else waits on its booking', async () => {
    const { runtime } = await attached({ connected: false });
    const alone = await runtime.enqueue({ ...checkIn, kind: 'check_in', ifMatch: '"3"' });
    expect(alone).toMatchObject({ ifMatch: '"3"' });

    const { runtime: other } = await attached({ connected: false });
    await other.enqueue(note);
    const behind = await other.enqueue({ ...checkIn, kind: 'check_in', ifMatch: '"3"' });
    expect(behind).not.toHaveProperty('ifMatch');
  });

  it('empties queue and cache on a voluntary unpair', async () => {
    const { runtime, store } = await attached({ connected: false });
    await runtime.enqueue(note);
    await runtime.detach('unpaired');
    expect(runtime.queue.getSnapshot()).toEqual([]);
    expect(store.snapshot()[CACHE_KEY]).toBeUndefined();
  });

  it('keeps the queue but drops the cache when the token is revoked', async () => {
    const { runtime, store } = await attached({ connected: false });
    await runtime.enqueue(note);
    await runtime.detach('revoked');
    expect(runtime.queue.getSnapshot()).toHaveLength(1);
    expect(store.snapshot()[CACHE_KEY]).toBeUndefined();
  });

  it('tells TanStack the device has no network before the first query runs', async () => {
    const { runtime, network } = setup({ connected: false });
    await runtime.boot(SESSION);
    expect(onlineManager.isOnline()).toBe(false);
    runtime.attach(SESSION, setup().client);
    network.set(true);
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('refuses to enqueue without a paired session', async () => {
    const { runtime } = setup();
    await runtime.boot(null);
    await expect(runtime.enqueue(note)).rejects.toThrow();
  });
});
