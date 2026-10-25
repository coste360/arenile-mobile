import { router } from 'expo-router';
import { act, fireEvent, waitFor } from 'expo-router/testing-library';

import { QueryClient } from '@tanstack/react-query';

import { estKeys } from '@/api/query-keys';
import { CACHE_KEY, createOfflineCache } from '@/features/offline/persist';
import { queryKeys } from '@/features/session/queries';
import { createMemoryKeyValueStore } from '@/lib/storage';
import { DAY, DAY_BOOKINGS, dayRoutes, EST, TODAY } from '@/test/day-routes';
import { DEVICE, networkDown } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { renderApp, type WindowSize } from '@/test/render-app';

async function openToday(size: WindowSize = 'phone', routes = dayRoutes()) {
  const app = await renderApp({ session: SESSION, routes, size });
  expect(await app.screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
  await act(async () => router.push('/today'));
  await waitFor(() => expect(app.getPathname()).toBe('/today'));
  return app;
}

describe('Oggi', () => {
  it.each<WindowSize>(['phone', 'tablet'])('sums up the day on a %s', async (size) => {
    const { screen } = await openToday(size);
    expect(await screen.findByText('Oggi, domenica 25 ottobre')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Arrivi: 2' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Presenti: 1' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Postazioni libere: 2, su 4' })).toBeOnTheScreen();
    // Rossi 20 € + the season pass 150 €; the cancelled booking does not count.
    expect(screen.getByRole('button', { name: /^Da saldare: 2, 170,00\s€$/ })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Giorni rilasciati dagli abbonati: 1' }),
    ).toBeOnTheScreen();
  });

  it('opens the arrivals list from its figure', async () => {
    const { screen, getPathname } = await openToday();
    await fireEvent.press(await screen.findByRole('button', { name: 'Arrivi: 2' }));

    await waitFor(() => expect(getPathname()).toBe('/bookings'));
    expect(
      await screen.findByRole('button', { name: 'Arrivi, 2', selected: true }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('booking-row-b-1')).toBeOnTheScreen();
    expect(screen.getByTestId('booking-row-b-2')).toBeOnTheScreen();
    expect(screen.queryByTestId('booking-row-b-3')).toBeNull();
    expect(screen.getByText('2 prenotazioni')).toBeOnTheScreen();
  });

  it('opens the bookings to settle', async () => {
    const { screen } = await openToday();
    await fireEvent.press(await screen.findByTestId('figure-to-settle'));
    expect(
      await screen.findByRole('button', { name: 'Da saldare, 2', selected: true }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('booking-row-b-3')).toBeOnTheScreen();
    expect(screen.queryByTestId('booking-row-b-2')).toBeNull();
  });

  it.each([
    ['figure-free', '2 postazioni', ['A10, Libera', 'B4, Rilasciata · Giornata intera']],
    ['figure-released', '1 postazione', ['B4, Rilasciata · Giornata intera']],
  ])('opens the spot list of %s', async (figure, count, rows) => {
    const { screen, getPathname } = await openToday();
    await fireEvent.press(await screen.findByTestId(figure));
    await waitFor(() => expect(getPathname()).toBe('/spots'));
    expect(await screen.findByText(count)).toBeOnTheScreen();
    expect(screen.getAllByRole('listitem').map((i) => i.props.accessibilityLabel)).toEqual(rows);
  });

  it('says when the establishment is closed', async () => {
    const { screen } = await openToday('phone', dayRoutes({ day: { ...DAY, closed: true } }));
    expect(await screen.findByText('Stabilimento chiuso')).toBeOnTheScreen();
  });

  it('explains that the day cannot be read and retries', async () => {
    const routes = dayRoutes();
    let fail = true;
    const ok = { day: routes[`GET ${EST}/operations/day`]!, list: routes[`GET ${EST}/bookings`]! };
    routes[`GET ${EST}/operations/day`] = (r) => (fail ? networkDown(r) : ok.day(r));
    routes[`GET ${EST}/bookings`] = (r) => (fail ? networkDown(r) : ok.list(r));
    const { screen } = await openToday('phone', routes);

    expect(
      await screen.findByText('Dati del giorno non disponibili', {}, { timeout: 5000 }),
    ).toBeOnTheScreen();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('button', { name: 'Arrivi: 2' })).toBeOnTheScreen();
  }, 15000);

  it('shows the saved day after a cold start without network', async () => {
    const saved = createMemoryKeyValueStore();
    const before = new QueryClient();
    const cache = createOfflineCache({
      queryClient: before,
      store: saved,
      now: () => new Date('2026-10-25T07:30:00Z'),
    });
    const stop = await cache.start(SESSION);
    before.setQueryData(queryKeys.self(SESSION.deviceId), DEVICE);
    before.setQueryData(queryKeys.establishment(SESSION.establishmentId), {
      id: SESSION.establishmentId,
      name: 'Lido Azzurro',
      timezone: 'Europe/Rome',
    });
    before.setQueryData(estKeys.operationsDay(SESSION.establishmentId, TODAY), DAY, {
      updatedAt: Date.parse('2026-10-25T07:30:00Z'),
    });
    before.setQueryData(estKeys.bookingsOfDay(SESSION.establishmentId, TODAY), DAY_BOOKINGS, {
      updatedAt: Date.parse('2026-10-25T07:30:00Z'),
    });
    await waitFor(() => expect(saved.snapshot()[CACHE_KEY]).toContain('AR-5P4Z7'), {
      timeout: 3000,
    });
    stop();
    const snapshot = saved.snapshot()[CACHE_KEY]!;
    before.clear();

    const { screen, network } = await renderApp({
      session: SESSION,
      routes: {},
      connected: false,
      offlineData: { [CACHE_KEY]: snapshot },
    });
    expect(await screen.findByText('Lido Azzurro')).toBeOnTheScreen();
    await act(async () => router.push('/today'));
    expect(await screen.findByRole('button', { name: 'Arrivi: 2' })).toBeOnTheScreen();
    expect(
      await screen.findByText('Dati salvati sul dispositivo, aggiornati alle 08:30.'),
    ).toBeOnTheScreen();
    expect(network.calls).toHaveLength(0);
  });
});

describe('home shortcuts', () => {
  it('opens Oggi and the bookings of the day from the phone home', async () => {
    const { screen, getPathname } = await renderApp({ session: SESSION, routes: dayRoutes() });
    await fireEvent.press(await screen.findByRole('button', { name: 'Riepilogo di oggi' }));
    await waitFor(() => expect(getPathname()).toBe('/today'));
    await act(async () => router.back());
    await fireEvent.press(await screen.findByRole('button', { name: 'Prenotazioni del giorno' }));
    await waitFor(() => expect(getPathname()).toBe('/bookings'));
  });

  it('lists the day screens in the tablet navigation pane', async () => {
    const { screen, getPathname } = await renderApp({
      session: SESSION,
      routes: dayRoutes(),
      size: 'tablet',
    });
    await fireEvent.press(await screen.findByRole('link', { name: 'Oggi' }));
    await waitFor(() => expect(getPathname()).toBe('/today'));
    await fireEvent.press(screen.getByRole('link', { name: 'Prenotazioni' }));
    await waitFor(() => expect(getPathname()).toBe('/bookings'));
    expect(
      await screen.findByRole('link', { name: 'Prenotazioni', selected: true }),
    ).toBeOnTheScreen();
  });
});
