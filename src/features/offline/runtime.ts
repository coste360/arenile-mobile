// Composition of the offline mode: the persisted cache, the operation
// queue, connectivity and the replay triggers, wired to the TanStack Query
// client. Framework-free (React binds it in offline-provider.tsx), created
// once in AppProviders and booted before the first render, so a cold start
// without network shows the cached day at once.
import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

import type { ApiClient } from '@/api/client';
import { NetworkError } from '@/api/errors';
import type { SignOutReason } from '@/features/session/session-provider';
import type { Session } from '@/features/session/session';
import { errorKind } from '@/lib/log';
import type { NetworkMonitor } from '@/lib/network';
import type { KeyValueStore } from '@/lib/storage';

import { applyOptimistic, invalidateAfter } from './optimistic';
import { createOfflineCache, type OfflineCache } from './persist';
import { prefetchOfflineWindow } from './prefetch';
import { createOperationQueue, sameScope, type FlushResult, type OperationQueue } from './queue';
import { sendOfflineOperation } from './senders';
import type {
  ConnectionState,
  NewOfflineOperation,
  OfflineOperation,
  OperationScope,
} from './types';

/** While operations wait and the device is connected, try again this often. */
export const RETRY_INTERVAL_MS = 30_000;

export interface OfflineStatus {
  connection: ConnectionState;
  /** Operations waiting to be sent (pending or being sent). */
  pending: number;
  /** Operations refused by the server for a conflict (409/412/422). */
  conflicts: number;
  /** Operations refused for another reason (403, 404, other pairing...). */
  failed: number;
  /** The queue waits for a new pairing (the token was revoked). */
  paused: boolean;
}

export interface OfflineRuntime {
  readonly queue: OperationQueue<OfflineOperation>;
  readonly cache: OfflineCache;
  /** Restores the cache of `session` and loads the queue (before the first render). */
  boot(session: Session | null): Promise<void>;
  /** A paired session with its API client: start saving, sending and listening. */
  attach(session: Session, client: ApiClient): void;
  /**
   * Sign-out. The cached data goes in both cases (personal data of the day).
   * A voluntary unpair also empties the queue (the user was warned); after
   * a revocation the queue is kept, paused, for the next pairing of the same
   * establishment (it holds cash really collected).
   */
  detach(reason: SignOutReason | undefined): Promise<void>;
  /** Queues an operation, shows it on the cached day and tries to send it. */
  enqueue(input: NewOfflineOperation): Promise<OfflineOperation>;
  /** Sends the queue now (no-op without a session or without network). */
  flush(): Promise<FlushResult | undefined>;
  retry(id: string): Promise<void>;
  discard(id: string): Promise<void>;
  getStatus(): OfflineStatus;
  subscribe(listener: () => void): () => void;
  /** Called when a replay meets a 401 `unauthorized` (sign the session out). */
  onUnauthorized(listener: () => void): () => void;
  /** Called after every flush that sent or refused something. */
  onFlushed(listener: (result: FlushResult) => void): () => void;
  /** Stops listeners and timers (unmount). */
  stop(): void;
}

export interface OfflineRuntimeOptions {
  queryClient: QueryClient;
  store: KeyValueStore;
  network: NetworkMonitor;
  now: () => Date;
  newId: () => string;
}

export function createOfflineRuntime(options: OfflineRuntimeOptions): OfflineRuntime {
  const { queryClient, store, network, now, newId } = options;
  let client: ApiClient | null = null;
  let current: Session | null = null;
  let scope: OperationScope | null = null;
  let cachedDevice: string | null = null;
  let stopCache: (() => void) | null = null;
  let deviceConnected: boolean | null = null;
  let reachable: boolean | null = null;
  let status: OfflineStatus | null = null;
  let teardown: (() => void)[] = [];
  const listeners = new Set<() => void>();
  const unauthorizedListeners = new Set<() => void>();
  const flushedListeners = new Set<(r: FlushResult) => void>();

  const cache = createOfflineCache({ queryClient, store, now });
  const queue = createOperationQueue<OfflineOperation>({
    store,
    send: (op) => {
      // Only the token of the operation's pairing may send it: a drain still
      // running for a previous pairing must not use the new session's client.
      if (!client || !scope || !sameScope(op.scope, scope)) {
        return Promise.reject(new NetworkError('unreachable'));
      }
      return sendOfflineOperation(client, op);
    },
    now,
    newId,
    onSent: (op) => invalidateAfter(queryClient, op),
    // The optimistic change was wrong: reload the real state.
    onRejected: (op) => invalidateAfter(queryClient, op),
  });

  const emit = () => {
    status = null;
    for (const l of [...listeners]) l();
  };
  queue.subscribe(emit);

  const computeStatus = (): OfflineStatus => {
    const ops = queue.getSnapshot();
    const mine = scope ? ops : [];
    const count = (pred: (o: OfflineOperation) => boolean) => mine.filter(pred).length;
    const connection: ConnectionState =
      deviceConnected === false
        ? 'offline'
        : queue.isFlushing()
          ? 'syncing'
          : reachable === false
            ? 'unreachable'
            : 'online';
    return {
      connection,
      pending: count((o) => o.status === 'pending' || o.status === 'sending'),
      conflicts: count((o) => o.status === 'conflict'),
      failed: count((o) => o.status === 'failed'),
      paused: queue.isPaused(),
    };
  };

  const setReachable = (value: boolean) => {
    if (reachable === value) return;
    const wasDown = reachable === false;
    reachable = value;
    emit();
    if (value && wasDown) void flush();
  };

  const flush = async (): Promise<FlushResult | undefined> => {
    if (!client || !scope || deviceConnected === false) return undefined;
    const pending = queue.getSnapshot().some((o) => o.status === 'pending');
    if (!pending) return undefined;
    const run = queue.flush(scope);
    emit();
    let result: FlushResult;
    try {
      result = await run;
    } catch (e) {
      console.warn('offline queue: flush failed', errorKind(e));
      return undefined;
    }
    if (result.unauthorized) for (const l of [...unauthorizedListeners]) l();
    else if (result.blocked) setReachable(false);
    if (result.sent > 0) setReachable(true);
    if (result.sent + result.conflicts + result.failed > 0) {
      for (const l of [...flushedListeners]) l(result);
    }
    emit();
    return result;
  };

  /** Fills the cache with today's and tomorrow's data while the instance answers. */
  const warmUp = () => {
    if (!client || !current || deviceConnected === false) return;
    prefetchOfflineWindow(queryClient, client, current, now()).catch(() => undefined);
  };

  const startCache = async (session: Session) => {
    if (cachedDevice === session.deviceId) return;
    cachedDevice = session.deviceId;
    stopCache = await cache.start(session);
  };

  /** TanStack pauses queries without a network and refetches on reconnection. */
  const setDeviceConnected = (connected: boolean | null) => {
    deviceConnected = connected;
    onlineManager.setOnline(connected !== false);
  };

  const listen = () => {
    if (teardown.length > 0) return;
    const onConnected = (connected: boolean | null) => {
      const was = deviceConnected;
      setDeviceConnected(connected);
      emit();
      if (connected !== false && was === false) {
        void flush();
        warmUp();
      }
    };
    void network.current().then(onConnected, () => onConnected(null));
    teardown.push(network.subscribe(onConnected));
    teardown.push(() => onlineManager.setOnline(true));
    // Every answer of the instance tells whether it is reachable.
    teardown.push(
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== 'updated') return;
        if (event.action.type === 'success') setReachable(true);
        else if (event.action.type === 'error' && event.action.error instanceof NetworkError) {
          setReachable(false);
        }
      }),
    );
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      void flush();
      warmUp();
    });
    teardown.push(() => sub.remove());
    const timer = setInterval(() => {
      if (!queue.isFlushing() && !queue.isPaused()) void flush();
    }, RETRY_INTERVAL_MS);
    teardown.push(() => clearInterval(timer));
  };

  return {
    queue,
    cache,
    async boot(session) {
      // Connectivity is known before the first query runs: a cold start
      // without network shows the cache instead of failing requests. The OS
      // state is the only source (no browser events in React Native).
      onlineManager.setEventListener(() => () => {});
      setDeviceConnected(await network.current().catch(() => null));
      await queue.init().catch((e: unknown) => {
        console.warn('offline queue: load failed', errorKind(e));
      });
      if (session) await startCache(session);
    },
    attach(session, apiClient) {
      client = apiClient;
      current = session;
      const next = { instanceUrl: session.instanceUrl, establishmentId: session.establishmentId };
      scope = next;
      // A new token may send what a revoked one could not.
      if (queue.isPaused()) queue.resume();
      listen();
      void startCache(session)
        .then(() => queue.quarantine(next))
        .then(() => flush())
        .then(warmUp);
      emit();
    },
    async detach(reason) {
      client = null;
      current = null;
      scope = null;
      cachedDevice = null;
      stopCache?.();
      stopCache = null;
      await cache.clear();
      if (reason === 'unpaired') await queue.clear();
      emit();
    },
    async enqueue(input) {
      if (!scope) throw new Error('offline queue: enqueue without a paired session');
      let op = input;
      // A check-in queued behind other operations on the same booking (waiting
      // or being sent) cannot know the version the server will have when its
      // turn comes (an earlier one may be refused): drop it, the sender uses
      // If-Match "*".
      if (op.kind === 'check_in' && op.ifMatch !== undefined) {
        const behind = queue
          .getSnapshot()
          .some(
            (o) =>
              o.bookingId === op.bookingId && (o.status === 'pending' || o.status === 'sending'),
          );
        if (behind) {
          const { ifMatch: _drop, ...rest } = op;
          op = rest;
        }
      }
      const queued = await queue.enqueue({ ...op, scope });
      applyOptimistic(queryClient, queued);
      // The OS may say online while the instance is not: try at once anyway.
      void flush();
      return queued;
    },
    flush,
    retry: async (id) => {
      await queue.retry(id);
      void flush();
    },
    discard: (id) => queue.discard(id),
    getStatus() {
      status ??= computeStatus();
      return status;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    onUnauthorized(listener) {
      unauthorizedListeners.add(listener);
      return () => {
        unauthorizedListeners.delete(listener);
      };
    },
    onFlushed(listener) {
      flushedListeners.add(listener);
      return () => {
        flushedListeners.delete(listener);
      };
    },
    stop() {
      for (const t of teardown) t();
      teardown = [];
      stopCache?.();
      stopCache = null;
      cachedDevice = null;
    },
  };
}
