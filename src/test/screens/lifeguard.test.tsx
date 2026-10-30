import { router } from 'expo-router';
import { act, fireEvent, waitFor, within } from 'expo-router/testing-library';

import { QueryClient } from '@tanstack/react-query';

import { estKeys } from '@/api/query-keys';
import type { LifeguardList, LifeguardRow, Role } from '@/api/types';
import { CACHE_KEY, createOfflineCache } from '@/features/offline/persist';
import { queryKeys } from '@/features/session/queries';
import { createMemoryKeyValueStore } from '@/lib/storage';
import { datesRequested, pickDay } from '@/test/day-picker';
import { DAY, dayRoutes, EST, TODAY, TOMORROW } from '@/test/day-routes';
import { DEVICE, json, networkDown, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { renderApp, type WindowSize } from '@/test/render-app';

const PATH = `${EST}/operations/lifeguard-list`;

const row = (spot: string, overrides: Partial<LifeguardRow> = {}): LifeguardRow => ({
  row_label: spot.slice(0, 1),
  spot_id: `s-${spot}`,
  spot_label: spot,
  occupant_label: 'Rossi',
  arriving: false,
  departing: false,
  balance_due: false,
  ...overrides,
});

const LIST: LifeguardList = {
  date: TODAY,
  slot: 'FULL',
  rows: [
    row('A1', { arriving: true, setup_label: '2L 1S', balance_due: true }),
    row('A2', { occupant_label: 'Bianchi', departing: true, group_name: 'Famiglia Bianchi' }),
    row('B4', { occupant_label: '' }),
  ],
  totals: DAY.totals,
};

function routes(options: { role?: Role; list?: Handler } = {}) {
  return {
    ...dayRoutes({ role: options.role }),
    [`GET ${PATH}`]:
      options.list ??
      ((r: Request) =>
        new URL(r.url).searchParams.get('date') === TODAY
          ? json(200, LIST)
          : json(200, { ...LIST, date: new URL(r.url).searchParams.get('date'), rows: [] })),
  };
}

async function openList(size: WindowSize = 'phone', r = routes()) {
  const app = await renderApp({ session: SESSION, routes: r, size });
  expect(await app.screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
  await act(async () => router.push('/lifeguard'));
  await waitFor(() => expect(app.getPathname()).toBe('/lifeguard'));
  return app;
}

describe('Lista bagnini', () => {
  it.each<WindowSize>(['phone', 'tabletPortrait', 'tabletLandscape'])(
    'lists the occupied spots row by row on a %s',
    async (size) => {
      const { screen, network } = await openList(size);
      const rowA = await screen.findByLabelText('Fila A');
      expect(within(rowA).getByLabelText('A1, Rossi, 2L 1S, Arrivo, Da saldare')).toBeOnTheScreen();
      expect(
        within(rowA).getByLabelText('A2, Bianchi, Famiglia Bianchi, Partenza'),
      ).toBeOnTheScreen();
      const rowB = screen.getByLabelText('Fila B');
      // An anonymised customer has no last name.
      expect(within(rowB).getByLabelText('B4, Cliente anonimo')).toBeOnTheScreen();
      expect(screen.getByText('3 postazioni occupate')).toBeOnTheScreen();
      const asked = network.calls.find((r) => new URL(r.url).pathname === PATH)!;
      expect(new URL(asked.url).searchParams.get('format')).toBe('json');
    },
  );

  it('filters arrivals, departures and balances due', async () => {
    const { screen } = await openList();
    await fireEvent.press(await screen.findByRole('button', { name: 'Arrivi: 1' }));
    expect(await screen.findByText('1 postazione occupata')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^A1, Rossi/)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Fila B')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Partenze: 1' }));
    expect(await screen.findByLabelText(/^A2, Bianchi/)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^A1, Rossi/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Da saldare: 1' }));
    expect(await screen.findByLabelText(/^A1, Rossi/)).toBeOnTheScreen();
  });

  it('reads another day from the calendar and says when nobody is there', async () => {
    const { screen, network } = await openList();
    expect(await screen.findByLabelText(/^A1, Rossi/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: /^Domani/ }));
    expect(
      await screen.findByText('Nessuna postazione occupata in questo giorno.'),
    ).toBeOnTheScreen();
    await pickDay(screen, '2026-11-02');
    await waitFor(() =>
      expect(datesRequested(network.calls, PATH)).toEqual([TODAY, TOMORROW, '2026-11-02']),
    );
  });

  it('says when the role may not read it', async () => {
    const { screen } = await openList('phone', routes({ list: () => problem(403, 'forbidden') }));
    expect(await screen.findByText('Non consentito per il tuo ruolo.')).toBeOnTheScreen();
  });

  it('explains that the list cannot be read and retries', async () => {
    let fail = true;
    const ok = routes()[`GET ${PATH}`]!;
    const { screen } = await openList(
      'phone',
      routes({ list: (r) => (fail ? networkDown(r) : ok(r)) }),
    );
    expect(
      await screen.findByText('Dati del giorno non disponibili', {}, { timeout: 5000 }),
    ).toBeOnTheScreen();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByLabelText(/^A1, Rossi/)).toBeOnTheScreen();
  }, 15000);

  it("shows today's saved list after a cold start without network", async () => {
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
    before.setQueryData(estKeys.lifeguardList(SESSION.establishmentId, TODAY), LIST, {
      updatedAt: Date.parse('2026-10-25T07:30:00Z'),
    });
    await waitFor(() => expect(saved.snapshot()[CACHE_KEY]).toContain('Famiglia Bianchi'), {
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
    await act(async () => router.push('/lifeguard'));
    expect(await screen.findByLabelText(/^A1, Rossi/)).toBeOnTheScreen();
    expect(
      await screen.findByText('Dati salvati sul dispositivo, aggiornati alle 08:30.'),
    ).toBeOnTheScreen();
    // Another day is online only.
    await pickDay(screen, '2026-11-02');
    expect(await screen.findByText('Giorno disponibile solo online')).toBeOnTheScreen();
    expect(network.calls).toHaveLength(0);
  });
});

describe('Lista bagnini entry points', () => {
  it('opens from the phone home', async () => {
    const { screen, getPathname } = await renderApp({ session: SESSION, routes: routes() });
    await fireEvent.press(await screen.findByRole('button', { name: 'Lista bagnini' }));
    await waitFor(() => expect(getPathname()).toBe('/lifeguard'));
  });

  it('is in the tablet navigation pane', async () => {
    const { screen, getPathname } = await renderApp({
      session: SESSION,
      routes: routes(),
      size: 'tablet',
    });
    await fireEvent.press(await screen.findByRole('link', { name: 'Lista bagnini' }));
    await waitFor(() => expect(getPathname()).toBe('/lifeguard'));
    expect(
      await screen.findByRole('link', { name: 'Lista bagnini', selected: true }),
    ).toBeOnTheScreen();
  });

  // /auth/me without bookings.read: the list names the guests, so it stays hidden.
  const withoutBookingsRead = {
    ...routes(),
    'GET /api/admin/v1/auth/me': () =>
      json(200, {
        principal_type: 'user',
        totp_enrolment_required: false,
        memberships: [
          {
            organization_id: 'org-1',
            establishment_id: SESSION.establishmentId,
            role: 'beach_staff',
            permissions: ['operations.run'],
          },
        ],
      }),
  };

  it('is not on the phone home without bookings.read', async () => {
    const { screen } = await renderApp({ session: SESSION, routes: withoutBookingsRead });
    expect(await screen.findByText(/^Anna · /)).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lista bagnini' })).toBeNull());
  });

  it('is not in the tablet navigation pane without bookings.read', async () => {
    const { screen } = await renderApp({
      session: SESSION,
      routes: withoutBookingsRead,
      size: 'tablet',
    });
    expect(await screen.findByRole('link', { name: 'Mappa' })).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Lista bagnini' })).toBeNull());
  });
});
