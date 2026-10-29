// What the app keeps on the device for offline consultation (spec 21.2,
// core spec 22-23), as an allowlist on TanStack Query keys applied when
// saving and again after restoring:
//
// - ['device','self',deviceId], ['instance','meta',url], ['establishment',id],
//   ['auth','me',deviceId]: who is paired, the role and permissions, the
//   establishment name and time zone (needed to compute "today" offline);
// - ['est',<paired>,'maps',…]: the maps and map documents;
// - ['est',<paired>,'operations','day',{date}],
//   ['est',<paired>,'operations','lifeguard',{date}] and
//   ['est',<paired>,'bookings','day',{date}] for today and tomorrow in the
//   establishment zone;
// - ['est',<paired>,'bookings','detail',id] when the stay overlaps today or
//   tomorrow.
//
// Everything else (customer lists, payments, reports, cash) stays in memory.
// The snapshot is bound to the pairing (buster = format + device id), is
// dropped after 48 hours, and is removed on sign-out (unpair or revocation).
import {
  defaultShouldDehydrateQuery,
  type Query,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
  type Persister,
} from '@tanstack/react-query-persist-client';

import type { Establishment } from '@/api/types';
import { queryKeys } from '@/features/session/queries';
import type { Session } from '@/features/session/session';
import { operationalDays } from '@/lib/calendar';
import { errorKind } from '@/lib/log';
import type { KeyValueStore } from '@/lib/storage';

export const CACHE_KEY = 'arenile.offline.cache.v1';
/** Bump when the persisted query shapes change incompatibly. */
export const CACHE_FORMAT = 'mobile-1';
export const OFFLINE_MAX_AGE_MS = 48 * 3_600_000;
const THROTTLE_MS = 1_000;

export interface PersistPolicyContext {
  session: Pick<Session, 'deviceId' | 'establishmentId' | 'instanceUrl'>;
  /** Establishment time zone, if known (from the cached establishment). */
  timeZone: () => string | undefined;
  now: () => Date;
}

interface Stay {
  starts_on?: unknown;
  ends_on?: unknown;
}

function overlaps(data: unknown, today: string, tomorrow: string): boolean {
  const s = data as Stay | null;
  if (!s || typeof s.starts_on !== 'string' || typeof s.ends_on !== 'string') return false;
  return s.starts_on <= tomorrow && s.ends_on >= today;
}

const sameKey = (a: QueryKey, b: QueryKey) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** The allowlist (pure, on the key and data of a query). */
export function isPersistable(
  key: QueryKey,
  data: unknown,
  { session, timeZone, now }: PersistPolicyContext,
): boolean {
  if (sameKey(key, queryKeys.self(session.deviceId))) return true;
  if (sameKey(key, queryKeys.meta(session.instanceUrl))) return true;
  if (sameKey(key, queryKeys.establishment(session.establishmentId))) return true;
  if (sameKey(key, ['auth', 'me', session.deviceId])) return true;
  const [root, est, area, kind, param] = key;
  if (root !== 'est' || est !== session.establishmentId) return false;
  if (area === 'maps') return kind === 'list' || kind === 'detail';
  const { today, tomorrow } = operationalDays(timeZone(), now());
  const dayList =
    (area === 'operations' && (kind === 'day' || kind === 'lifeguard')) ||
    (area === 'bookings' && kind === 'day');
  if (dayList) {
    const date = (param as { date?: unknown } | undefined)?.date;
    return date === today || date === tomorrow;
  }
  if (area === 'bookings' && kind === 'detail') return overlaps(data, today, tomorrow);
  return false;
}

/** The time zone of the paired establishment, from the cache. */
export function cachedTimeZone(qc: QueryClient, establishmentId: string): string | undefined {
  return qc.getQueryData<Establishment>(queryKeys.establishment(establishmentId))?.timezone;
}

export interface OfflineCache {
  /** Restores the paired session's snapshot, then saves every change. Returns the stop function. */
  start(session: Session): Promise<() => void>;
  /** Stops saving and removes the snapshot (sign-out). */
  clear(): Promise<void>;
}

export function createOfflineCache(options: {
  queryClient: QueryClient;
  store: KeyValueStore;
  now: () => Date;
}): OfflineCache {
  const { queryClient, store, now } = options;
  // Writes are accepted only while a session is persisting: a throttled
  // save still in flight after sign-out must not resurrect the snapshot.
  let generation = 0;
  let active = -1;
  const guarded = {
    getItem: (key: string) => store.getItem(key),
    setItem: async (key: string, value: string) => {
      const gen = generation;
      if (gen !== active) return;
      await store.setItem(key, value);
      // Signed out meanwhile: undo the late write.
      if (gen !== active) await store.deleteItem(key);
    },
    removeItem: (key: string) => store.deleteItem(key),
  };
  const persister: Persister = createAsyncStoragePersister({
    storage: guarded,
    key: CACHE_KEY,
    throttleTime: THROTTLE_MS,
  });
  let stop: (() => void) | null = null;

  const policyFor = (session: Session) => {
    const ctx: PersistPolicyContext = {
      session,
      timeZone: () => cachedTimeZone(queryClient, session.establishmentId),
      now,
    };
    return (query: Query) =>
      defaultShouldDehydrateQuery(query) && isPersistable(query.queryKey, query.state.data, ctx);
  };

  return {
    async start(session) {
      stop?.();
      generation += 1;
      active = generation;
      const buster = `${CACHE_FORMAT}:${session.deviceId}`;
      const shouldPersist = policyFor(session);
      try {
        await persistQueryClientRestore({
          queryClient,
          persister,
          buster,
          maxAge: OFFLINE_MAX_AGE_MS,
        });
        // Yesterday's day (or a booking no longer in the window) is not kept.
        queryClient.removeQueries({
          predicate: (q) =>
            q.queryKey[0] === 'est' && q.state.status === 'success' && !shouldPersist(q),
        });
      } catch (e) {
        console.warn('offline cache: restore failed', errorKind(e));
      }
      const unsubscribe = persistQueryClientSubscribe({
        queryClient,
        persister,
        buster,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersist,
          shouldDehydrateMutation: () => false,
        },
      });
      stop = () => {
        unsubscribe();
        stop = null;
      };
      return stop;
    },
    async clear() {
      stop?.();
      generation += 1;
      active = -1;
      try {
        await persister.removeClient();
      } catch (e) {
        console.warn('offline cache: remove failed', errorKind(e));
      }
    },
  };
}
