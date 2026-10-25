import { router } from 'expo-router';
import { act, fireEvent, waitFor } from 'expo-router/testing-library';

import { QueryClient } from '@tanstack/react-query';

import { CACHE_KEY, createOfflineCache } from '@/features/offline/persist';
import { QUEUE_KEY } from '@/features/offline/queue';
import type { OfflineOperation } from '@/features/offline/types';
import { DEVICE, json, meta, networkDown, problem, type Handler } from '@/test/fake-fetch';
import { queryKeys } from '@/features/session/queries';
import { createMemoryKeyValueStore } from '@/lib/storage';
import { SESSION } from '@/test/fixtures';
import { renderApp, type WindowSize } from '@/test/render-app';

const EST = `/api/admin/v1/establishments/${SESSION.establishmentId}`;

const ONLINE: Record<string, Handler> = {
  'GET /api/device/v1/self': () => json(200, DEVICE),
  'GET /api/admin/v1/meta': () => json(200, meta()),
  [`GET ${EST}`]: () =>
    json(200, {
      id: SESSION.establishmentId,
      name: 'Lido Azzurro',
      timezone: 'Europe/Rome',
      organization_id: 'org-1',
    }),
  'DELETE /api/device/v1/self': () => new Response(null, { status: 204 }),
};

const OFFLINE: Record<string, Handler> = {
  'GET /api/device/v1/self': networkDown,
  'GET /api/admin/v1/meta': networkDown,
  [`GET ${EST}`]: networkDown,
};

function queued(overrides: Partial<OfflineOperation> = {}): OfflineOperation {
  return {
    id: 'op-1',
    idempotencyKey: 'key-0001-abcd',
    createdAt: '2026-10-25T07:30:00.000Z',
    seq: 1,
    status: 'pending',
    scope: { instanceUrl: SESSION.instanceUrl, establishmentId: SESSION.establishmentId },
    kind: 'cash_payment',
    bookingId: 'b-1',
    amount: 1250,
    label: 'A1 · AR-7K3Q9',
    ...overrides,
  } as OfflineOperation;
}

const queue = (...ops: OfflineOperation[]) => ({ [QUEUE_KEY]: JSON.stringify(ops) });

describe('connection indicator', () => {
  it.each<WindowSize>(['phone', 'tablet'])('is visible on the %s home', async (size) => {
    const { screen } = await renderApp({ session: SESSION, routes: ONLINE, size });
    expect(await screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Connesso' })).toBeOnTheScreen();
  });

  it.each<WindowSize>(['phone', 'tablet'])(
    'shows no network and the pending count on the %s',
    async (size) => {
      const { screen } = await renderApp({
        session: SESSION,
        routes: OFFLINE,
        size,
        connected: false,
        offlineData: queue(queued()),
      });
      expect(
        await screen.findByRole('button', { name: 'Senza rete, 1 operazione in attesa' }),
      ).toBeOnTheScreen();
      expect(screen.getAllByText('Senza rete').length).toBeGreaterThan(0);
    },
  );

  it('sends the queue on reconnection with its idempotency key', async () => {
    const payment = jest.fn(() => json(201, {}));
    const { screen, connectivity, network } = await renderApp({
      session: SESSION,
      routes: { ...ONLINE, [`POST ${EST}/bookings/b-1/payments`]: payment },
      connected: false,
      offlineData: queue(queued()),
    });
    expect(
      await screen.findByRole('button', { name: 'Senza rete, 1 operazione in attesa' }),
    ).toBeOnTheScreen();

    await act(async () => connectivity.set(true));

    await waitFor(() => expect(payment).toHaveBeenCalledTimes(1));
    const sent = network.calls.find((r) => new URL(r.url).pathname.endsWith('/payments'));
    expect(sent?.headers.get('Idempotency-Key')).toBe('key-0001-abcd');
    expect(await sent?.clone().json()).toEqual({ amount: 1250, method: 'cash' });
    expect(await screen.findByRole('button', { name: 'Connesso' })).toBeOnTheScreen();
  });

  it('flags a refused operation for the user', async () => {
    const { screen } = await renderApp({
      session: SESSION,
      routes: {
        ...ONLINE,
        [`POST ${EST}/bookings/b-1/payments`]: () => problem(409, 'cash_session_closed'),
      },
      offlineData: queue(queued()),
    });
    expect(
      await screen.findByRole('button', { name: 'Connesso, 1 operazione da controllare' }),
    ).toBeOnTheScreen();
  });
});

describe('pending operations screen', () => {
  it.each<WindowSize>(['phone', 'tablet'])('is empty when nothing waits (%s)', async (size) => {
    const { screen } = await renderApp({ session: SESSION, routes: ONLINE, size });
    expect(await screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
    await act(async () => router.push('/pending'));
    expect(await screen.findByText('Nessuna operazione in attesa')).toBeOnTheScreen();
  });

  it('lists what waits, in order, with amounts in Italian', async () => {
    const { screen } = await renderApp({
      session: SESSION,
      routes: OFFLINE,
      connected: false,
      offlineData: queue(
        queued(),
        queued({
          id: 'op-2',
          idempotencyKey: 'key-0002-abcd',
          seq: 2,
          kind: 'check_in',
          bookingId: 'b-2',
          label: 'B4 · AR-2M8X1',
        } as Partial<OfflineOperation>),
      ),
    });
    await act(async () => router.push('/pending'));
    expect(await screen.findByText(/Incasso in contanti di 12,50/)).toBeOnTheScreen();
    expect(screen.getByText('Check-in')).toBeOnTheScreen();
    expect(screen.getByText('B4 · AR-2M8X1')).toBeOnTheScreen();
    expect(screen.getAllByText('In attesa')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Invia ora' })).toBeDisabled();
  });

  it('explains a conflict and deletes it only after confirmation', async () => {
    const { screen, offlineStore } = await renderApp({
      session: SESSION,
      routes: OFFLINE,
      connected: false,
      offlineData: queue(
        queued({ status: 'conflict', error: { status: 409, type: 'cash_session_closed' } }),
      ),
    });
    await act(async () => router.push('/pending'));
    expect(await screen.findByText(/La cassa è chiusa/)).toBeOnTheScreen();
    expect(screen.getByText('Da controllare')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Elimina' }));
    expect(await screen.findByText("Eliminare l'operazione?")).toBeOnTheScreen();
    const confirm = screen.getAllByRole('button', { name: 'Elimina' });
    await fireEvent.press(confirm[confirm.length - 1]!);

    expect(await screen.findByText('Nessuna operazione in attesa')).toBeOnTheScreen();
    await waitFor(() => expect(JSON.parse(offlineStore.snapshot()[QUEUE_KEY]!)).toEqual([]));
  });

  it('retries a refused operation with a new key', async () => {
    const payment = jest.fn(() => json(201, {}));
    const { screen, network } = await renderApp({
      session: SESSION,
      routes: { ...ONLINE, [`POST ${EST}/bookings/b-1/payments`]: payment },
      offlineData: queue(
        queued({ status: 'conflict', error: { status: 409, type: 'cash_session_closed' } }),
      ),
    });
    await act(async () => router.push('/pending'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Riprova' }));
    await waitFor(() => expect(payment).toHaveBeenCalledTimes(1));
    const sent = network.calls.find((r) => new URL(r.url).pathname.endsWith('/payments'));
    expect(sent?.headers.get('Idempotency-Key')).not.toBe('key-0001-abcd');
    expect(await screen.findByText('Nessuna operazione in attesa')).toBeOnTheScreen();
  });

  it('does not offer to retry an operation of another establishment', async () => {
    const { screen } = await renderApp({
      session: SESSION,
      routes: OFFLINE,
      connected: false,
      offlineData: queue(
        queued({ scope: { instanceUrl: 'https://altro.example.it', establishmentId: 'est-9' } }),
      ),
    });
    await act(async () => router.push('/pending'));
    expect(await screen.findByText(/collegamento precedente/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Riprova' })).toBeNull();
  });
});

describe('offline cache', () => {
  it('shows the cached data after a cold start without network', async () => {
    // What a previous run saved while online.
    const saved = createMemoryKeyValueStore();
    const before = new QueryClient();
    const cache = createOfflineCache({
      queryClient: before,
      store: saved,
      now: () => new Date('2026-10-25T08:00:00Z'),
    });
    const stop = await cache.start(SESSION);
    before.setQueryData(queryKeys.self(SESSION.deviceId), DEVICE);
    before.setQueryData(queryKeys.establishment(SESSION.establishmentId), {
      id: SESSION.establishmentId,
      name: 'Lido Azzurro',
      timezone: 'Europe/Rome',
    });
    await waitFor(() => expect(saved.snapshot()[CACHE_KEY]).toContain('Lido Azzurro'), {
      timeout: 3000,
    });
    stop();
    const savedSnapshot = saved.snapshot()[CACHE_KEY]!;
    before.clear();

    const { screen, network } = await renderApp({
      session: SESSION,
      routes: OFFLINE,
      connected: false,
      offlineData: { [CACHE_KEY]: savedSnapshot },
    });
    expect(await screen.findByText('Lido Azzurro')).toBeOnTheScreen();
    expect(screen.getByText('Anna · Cassiere')).toBeOnTheScreen();
    expect(network.calls).toHaveLength(0);
  });

  it('is removed when the device is unpaired, after warning about unsent operations', async () => {
    const { screen, offlineStore, getPathname } = await renderApp({
      session: SESSION,
      routes: { ...ONLINE, [`POST ${EST}/bookings/b-1/payments`]: networkDown },
      offlineData: queue(queued()),
    });
    expect(await screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
    await act(async () => router.push('/settings'));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Scollega questo dispositivo' }),
    );
    expect(
      await screen.findByText('Attenzione: 1 operazione non ancora inviata andrà persa.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Scollega' }));

    await waitFor(() => expect(getPathname()).toBe('/connect'), { timeout: 8000 });
    await waitFor(() => expect(offlineStore.snapshot()[CACHE_KEY]).toBeUndefined());
    await waitFor(() => expect(JSON.parse(offlineStore.snapshot()[QUEUE_KEY]!)).toEqual([]));
  }, 15000);
});
