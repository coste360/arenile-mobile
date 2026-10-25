import { QueryClient } from '@tanstack/react-query';

import { authKeys, estKeys } from '@/api/query-keys';
import { queryKeys } from '@/features/session/queries';
import { createMemoryKeyValueStore } from '@/lib/storage';
import { SESSION } from '@/test/fixtures';
import { bookingSummary, EST_ID, operationsDay } from '@/test/operations-fixtures';

import { CACHE_KEY, createOfflineCache, isPersistable, type PersistPolicyContext } from './persist';

// 2026-10-25 at 23:30 in Rome is 22:30 UTC (winter time from 01:00 UTC that day).
const ctx = (iso = '2026-10-25T08:00:00Z', timeZone: string | undefined = 'Europe/Rome') =>
  ({
    session: SESSION,
    timeZone: () => timeZone,
    now: () => new Date(iso),
  }) satisfies PersistPolicyContext;

describe('isPersistable', () => {
  it.each([
    ['the device', queryKeys.self(SESSION.deviceId), undefined, true],
    ['the instance meta', queryKeys.meta(SESSION.instanceUrl), undefined, true],
    ['the establishment', queryKeys.establishment(EST_ID), undefined, true],
    ['the principal', authKeys.me(SESSION.deviceId), undefined, true],
    ['another device', queryKeys.self('other'), undefined, false],
    ['the maps', estKeys.maps(EST_ID), undefined, true],
    ['a map document', estKeys.map(EST_ID, 'm-1'), undefined, true],
    ["today's day", estKeys.operationsDay(EST_ID, '2026-10-25'), undefined, true],
    ["tomorrow's day", estKeys.operationsDay(EST_ID, '2026-10-26'), undefined, true],
    ["yesterday's day", estKeys.operationsDay(EST_ID, '2026-10-24'), undefined, false],
    ['the day after tomorrow', estKeys.operationsDay(EST_ID, '2026-10-27'), undefined, false],
    ["today's bookings", estKeys.bookingsOfDay(EST_ID, '2026-10-25'), [], true],
    ["next week's bookings", estKeys.bookingsOfDay(EST_ID, '2026-11-01'), [], false],
    [
      'a booking staying today',
      estKeys.booking(EST_ID, 'b-1'),
      bookingSummary({ starts_on: '2026-10-20', ends_on: '2026-10-25' }),
      true,
    ],
    [
      'a booking starting tomorrow',
      estKeys.booking(EST_ID, 'b-1'),
      bookingSummary({ starts_on: '2026-10-26', ends_on: '2026-10-30' }),
      true,
    ],
    [
      'a past booking',
      estKeys.booking(EST_ID, 'b-1'),
      bookingSummary({ starts_on: '2026-08-01', ends_on: '2026-08-02' }),
      false,
    ],
    ['another establishment', estKeys.operationsDay('other', '2026-10-25'), undefined, false],
    ['payments', ['est', EST_ID, 'payments', 'list'], undefined, false],
    ['customers', ['est', EST_ID, 'customers', 'list'], undefined, false],
    ['anything else', ['x'], undefined, false],
  ])('%s → %p', (_name, key, data, expected) => {
    expect(isPersistable(key, data, ctx())).toBe(expected);
  });

  it('computes the window in the establishment zone', () => {
    // 23:30 in Rome: already the 26th there, still the 25th in UTC.
    const late = ctx('2026-10-25T23:30:00Z');
    expect(isPersistable(estKeys.operationsDay(EST_ID, '2026-10-27'), undefined, late)).toBe(true);
    expect(isPersistable(estKeys.operationsDay(EST_ID, '2026-10-25'), undefined, late)).toBe(false);
  });
});

describe('createOfflineCache', () => {
  const establishment = { id: EST_ID, timezone: 'Europe/Rome', organization_id: 'org-1' };

  function fill(qc: QueryClient) {
    qc.setQueryData(queryKeys.establishment(EST_ID), establishment);
    qc.setQueryData(estKeys.operationsDay(EST_ID, '2026-10-25'), operationsDay());
    qc.setQueryData(['est', EST_ID, 'customers', 'list'], [{ email: 'a@b.it' }]);
  }

  const now = () => new Date('2026-10-25T08:00:00Z');

  it('saves the allowlisted queries and restores them after a restart', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-25T08:00:00Z') });
    const store = createMemoryKeyValueStore();
    const first = new QueryClient();
    const cache = createOfflineCache({ queryClient: first, store, now });
    await cache.start(SESSION);
    fill(first);
    await jest.advanceTimersByTimeAsync(2_000);

    const saved = store.snapshot()[CACHE_KEY]!;
    expect(saved).toContain('operations');
    expect(saved).not.toContain('a@b.it');

    const second = new QueryClient();
    await createOfflineCache({ queryClient: second, store, now }).start(SESSION);
    expect(second.getQueryData(estKeys.operationsDay(EST_ID, '2026-10-25'))).toEqual(
      operationsDay(),
    );
    expect(second.getQueryData(['est', EST_ID, 'customers', 'list'])).toBeUndefined();
    first.clear();
    second.clear();
    jest.useRealTimers();
  });

  it('does not restore the snapshot of another pairing', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-25T08:00:00Z') });
    const store = createMemoryKeyValueStore();
    const first = new QueryClient();
    await createOfflineCache({ queryClient: first, store, now }).start(SESSION);
    fill(first);
    await jest.advanceTimersByTimeAsync(2_000);

    const second = new QueryClient();
    await createOfflineCache({ queryClient: second, store, now }).start({
      ...SESSION,
      deviceId: 'another-device',
    });
    expect(second.getQueryData(estKeys.operationsDay(EST_ID, '2026-10-25'))).toBeUndefined();
    first.clear();
    second.clear();
    jest.useRealTimers();
  });

  it('removes the snapshot on clear and ignores a save still in flight', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-25T08:00:00Z') });
    const store = createMemoryKeyValueStore();
    const qc = new QueryClient();
    const cache = createOfflineCache({ queryClient: qc, store, now });
    await cache.start(SESSION);
    fill(qc);
    await jest.advanceTimersByTimeAsync(2_000);
    expect(store.snapshot()[CACHE_KEY]).toBeDefined();

    // A change schedules a throttled save, then the user signs out.
    qc.setQueryData(estKeys.operationsDay(EST_ID, '2026-10-26'), operationsDay());
    await cache.clear();
    await jest.advanceTimersByTimeAsync(5_000);

    expect(store.snapshot()[CACHE_KEY]).toBeUndefined();
    qc.clear();
    jest.useRealTimers();
  });

  it('drops a restored day that left the window', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-25T08:00:00Z') });
    const store = createMemoryKeyValueStore();
    const first = new QueryClient();
    await createOfflineCache({ queryClient: first, store, now }).start(SESSION);
    fill(first);
    await jest.advanceTimersByTimeAsync(2_000);

    // Two days later (within the 48 h max age), today's day is yesterday's.
    jest.setSystemTime(new Date('2026-10-26T20:00:00Z'));
    const second = new QueryClient();
    await createOfflineCache({
      queryClient: second,
      store,
      now: () => new Date('2026-10-26T20:00:00Z'),
    }).start(SESSION);
    expect(second.getQueryData(queryKeys.establishment(EST_ID))).toEqual(establishment);
    expect(second.getQueryData(estKeys.operationsDay(EST_ID, '2026-10-25'))).toBeUndefined();
    first.clear();
    second.clear();
    jest.useRealTimers();
  });
});
