import { QueryClient } from '@tanstack/react-query';

import { createApiClient } from '@/api/client';
import { authKeys, estKeys } from '@/api/query-keys';
import { fakeFetch, json, problem } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { bookingSummary, EST_ID, operationsDay } from '@/test/operations-fixtures';

import { prefetchOfflineWindow } from './prefetch';

const EST = `/api/admin/v1/establishments/${EST_ID}`;

describe('prefetchOfflineWindow', () => {
  it("fetches maps, documents and the day of today and tomorrow in the establishment's zone", async () => {
    const network = fakeFetch({
      [`GET ${EST}`]: () => json(200, { id: EST_ID, timezone: 'Europe/Rome' }),
      [`GET ${EST}/maps`]: () =>
        json(200, {
          items: [
            { id: 'm-2', sort_order: 2 },
            { id: 'm-1', sort_order: 1 },
          ],
        }),
      [`GET ${EST}/maps/m-1`]: () => json(200, { map: { id: 'm-1' }, spots: [], decorations: [] }),
      [`GET ${EST}/maps/m-2`]: () => json(200, { map: { id: 'm-2' }, spots: [], decorations: [] }),
      [`GET ${EST}/operations/day`]: (r) =>
        json(200, operationsDay({ date: new URL(r.url).searchParams.get('date')! })),
      [`GET ${EST}/bookings`]: () => json(200, { items: [bookingSummary()] }),
      'GET /api/admin/v1/auth/me': () => problem(403, 'forbidden'),
    });
    const client = createApiClient({ baseUrl: SESSION.instanceUrl, fetch: network.fetch });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // 23:30 UTC on the 25th is already the 26th in Rome.
    await prefetchOfflineWindow(qc, client, SESSION, new Date('2026-10-25T23:30:00Z'));

    expect(qc.getQueryData(estKeys.maps(EST_ID))).toEqual([
      { id: 'm-1', sort_order: 1 },
      { id: 'm-2', sort_order: 2 },
    ]);
    expect(qc.getQueryData(estKeys.map(EST_ID, 'm-2'))).toBeDefined();
    expect(qc.getQueryData(estKeys.operationsDay(EST_ID, '2026-10-26'))).toBeDefined();
    expect(qc.getQueryData(estKeys.operationsDay(EST_ID, '2026-10-27'))).toBeDefined();
    expect(qc.getQueryData(estKeys.bookingsOfDay(EST_ID, '2026-10-27'))).toEqual([
      bookingSummary(),
    ]);
    // A refused resource is simply not cached.
    expect(qc.getQueryData(authKeys.me(SESSION.deviceId))).toBeUndefined();
    const bookings = network.calls.find((r) => new URL(r.url).pathname === `${EST}/bookings`)!;
    expect(new URL(bookings.url).searchParams.get('from')).toBe(
      new URL(bookings.url).searchParams.get('to'),
    );
    qc.clear();
  });

  it('reads every page of the bookings of a day', async () => {
    const network = fakeFetch({
      [`GET ${EST}`]: () => json(200, { id: EST_ID, timezone: 'Europe/Rome' }),
      [`GET ${EST}/bookings`]: (r) =>
        new URL(r.url).searchParams.get('cursor')
          ? json(200, { items: [bookingSummary({ id: 'b-2' })] })
          : json(200, { items: [bookingSummary()], next_cursor: 'c2' }),
    });
    const client = createApiClient({ baseUrl: SESSION.instanceUrl, fetch: network.fetch });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await prefetchOfflineWindow(qc, client, SESSION, new Date('2026-10-25T08:00:00Z'));
    expect(
      qc
        .getQueryData<{ id: string }[]>(estKeys.bookingsOfDay(EST_ID, '2026-10-25'))!
        .map((b) => b.id),
    ).toEqual(['b-1', 'b-2']);
    qc.clear();
  });
});
