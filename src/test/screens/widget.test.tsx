import { QueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { act, fireEvent, waitFor } from 'expo-router/testing-library';

import { estKeys } from '@/api/query-keys';
import { CACHE_KEY, createOfflineCache } from '@/features/offline/persist';
import { DEFAULT_PREFERENCES } from '@/features/preferences/preferences';
import { queryKeys } from '@/features/session/queries';
import { createMemoryKeyValueStore } from '@/lib/storage';
import { DEVICE, json, meta, networkDown, type Handler } from '@/test/fake-fetch';
import type { FakeWidget } from '@/test/fake-widget';
import { SESSION } from '@/test/fixtures';
import { operationsDay } from '@/test/operations-fixtures';
import { renderApp } from '@/test/render-app';

const EST = `/api/admin/v1/establishments/${SESSION.establishmentId}`;
const ESTABLISHMENT = {
  id: SESSION.establishmentId,
  name: 'Lido Azzurro',
  timezone: 'Europe/Rome',
  organization_id: 'org-1',
};

const DAY = operationsDay({
  totals: {
    spots: 40,
    free: 9,
    occupied: 31,
    arrivals: 12,
    departures: 0,
    checked_in: 4,
    balance_due_amount: 2000,
    pending_assignments: 0,
  },
});

const ONLINE: Record<string, Handler> = {
  'GET /api/device/v1/self': () => json(200, DEVICE),
  'GET /api/admin/v1/meta': () => json(200, meta()),
  [`GET ${EST}`]: () => json(200, ESTABLISHMENT),
  [`GET ${EST}/operations/day`]: (req) =>
    new URL(req.url).searchParams.get('date') === '2026-10-25'
      ? json(200, DAY)
      : json(200, operationsDay({ date: '2026-10-26' })),
};

const shown = (widget: FakeWidget) => widget.current()?.[0]?.props;

describe('home screen widget', () => {
  it("publishes today's counts once the day is in the cache", async () => {
    const { widget } = await renderApp({ session: SESSION, routes: ONLINE });

    await waitFor(() => expect(shown(widget)?.kind).toBe('summary'), { timeout: 3000 });
    expect(shown(widget)).toMatchObject({
      title: 'Lido Azzurro',
      subtitle: 'dom 25 ott',
      items: [
        { label: 'arrivi', value: '12' },
        { label: 'da saldare', value: '1' },
        { label: 'presenti', value: '4' },
        { label: 'libere', value: '9' },
      ],
    });
    // TanStack stamps the fetch with the real clock: only the format is checked.
    expect(shown(widget)?.footer).toMatch(/^Aggiornato alle \d{2}:\d{2}$/);
    // iOS replaces the counts at the establishment's midnight.
    expect(widget.current()?.[1]?.date.toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });

  it('shows the cached day after a cold start without network, asking nothing', async () => {
    const saved = createMemoryKeyValueStore();
    const before = new QueryClient();
    const cache = createOfflineCache({
      queryClient: before,
      store: saved,
      now: () => new Date('2026-10-25T08:00:00Z'),
    });
    const stop = await cache.start(SESSION);
    before.setQueryData(queryKeys.self(SESSION.deviceId), DEVICE);
    before.setQueryData(queryKeys.establishment(SESSION.establishmentId), ESTABLISHMENT);
    before.setQueryData(estKeys.operationsDay(SESSION.establishmentId, '2026-10-25'), DAY);
    await waitFor(() => expect(saved.snapshot()[CACHE_KEY]).toContain('2026-10-25'), {
      timeout: 3000,
    });
    stop();
    before.clear();

    const { widget, network } = await renderApp({
      session: SESSION,
      routes: {
        'GET /api/device/v1/self': networkDown,
        'GET /api/admin/v1/meta': networkDown,
        [`GET ${EST}`]: networkDown,
      },
      connected: false,
      offlineData: { [CACHE_KEY]: saved.snapshot()[CACHE_KEY]! },
    });

    await waitFor(() => expect(shown(widget)?.kind).toBe('summary'));
    expect(shown(widget)?.items[0]).toEqual({ label: 'arrivi', value: '12' });
    expect(network.calls).toHaveLength(0);
  });

  it('explains when today has not been downloaded yet', async () => {
    const { widget } = await renderApp({
      session: SESSION,
      routes: { ...ONLINE, [`GET ${EST}/operations/day`]: networkDown },
    });
    await waitFor(() =>
      expect(shown(widget)?.message).toBe(
        'Nessun dato di oggi sul dispositivo: apri Arenile con la rete per scaricarlo.',
      ),
    );
  });

  it('asks to pair when the device is not paired', async () => {
    const { widget } = await renderApp();
    await waitFor(() =>
      expect(shown(widget)).toMatchObject({
        kind: 'message',
        title: 'Arenile',
        message: 'Collega questo dispositivo in Arenile per vedere il riepilogo del giorno.',
      }),
    );
  });

  it('removes the counts when the device is unpaired', async () => {
    const { widget, screen, getPathname } = await renderApp({
      session: SESSION,
      routes: {
        ...ONLINE,
        'DELETE /api/device/v1/self': () => new Response(null, { status: 204 }),
      },
    });
    await waitFor(() => expect(shown(widget)?.kind).toBe('summary'), { timeout: 3000 });

    await act(async () => router.push('/settings'));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Scollega questo dispositivo' }),
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Scollega' }));

    await waitFor(() => expect(getPathname()).toBe('/connect'), { timeout: 8000 });
    await waitFor(() => expect(shown(widget)?.title).toBe('Arenile'));
    expect(JSON.stringify(widget.current())).not.toMatch(/Lido Azzurro|"12"/);
  });

  it('follows the language of the app', async () => {
    const { widget } = await renderApp({
      session: SESSION,
      routes: ONLINE,
      preferences: { ...DEFAULT_PREFERENCES, language: 'en' },
    });
    await waitFor(() => expect(shown(widget)?.kind).toBe('summary'), { timeout: 3000 });
    expect(shown(widget)?.items.map((i) => i.label)).toEqual([
      'arrivals',
      'to settle',
      'checked in',
      'free',
    ]);
  });
});
