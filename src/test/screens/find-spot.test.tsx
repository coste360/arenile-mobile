import { router } from 'expo-router';
import { act, fireEvent, waitFor } from 'expo-router/testing-library';

import type { AvailabilityResult, BookingCreate, Role } from '@/api/types';
import { json, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { EST, extra, pack, phase2Instance, requestsTo } from '@/test/phase-2-routes';
import { renderApp, type WindowSize } from '@/test/render-app';

type SpotAvailability = NonNullable<AvailabilityResult['zones'][number]['spots']>[number];

const DAY_MS = 86_400_000;

/** Map of phase 2: A1 free, A2 taken, A3 taken on the last day of the stay, B1 (row B) taken. */
function availabilityOf(url: URL): AvailabilityResult {
  const from = url.searchParams.get('from')!;
  const to = url.searchParams.get('to')!;
  const total = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
  const s = (spot_id: string, label: string, free: number): SpotAvailability => ({
    spot_id,
    label,
    status: free === total ? 'available' : 'unavailable',
    free_days: free,
    total_days: total,
  });
  return {
    from,
    to,
    slots: 'FULL',
    channel: 'desk',
    zones: [
      {
        zone_id: 'z-1',
        code: 'A',
        assignment_mode: 'seat',
        capacity: 3,
        available: 1,
        spots: [s('s-1', 'A1', total), s('s-2', 'A2', 0), s('s-3', 'A3', total - 1)],
      },
      {
        zone_id: 'z-2',
        code: 'B',
        assignment_mode: 'seat',
        capacity: 1,
        available: 0,
        spots: [s('s-4', 'B1', 0)],
      },
    ],
    pools: [],
  };
}

function findSpotRoutes(): Record<string, Handler> {
  return {
    [`GET ${EST}/availability`]: (r) => json(200, availabilityOf(new URL(r.url))),
    [`GET ${EST}/packs`]: () =>
      json(200, { items: [pack({ allowed_formulas: ['day', 'half_day', 'multi_day'] })] }),
    [`GET ${EST}/extras`]: () => json(200, { items: [extra()] }),
    [`POST ${EST}/bookings/quote`]: () =>
      json(200, {
        breakdown: {
          engine_version: 1,
          currency: 'EUR',
          lines: [],
          discounts: [],
          rounding: 0,
          total: 2500,
          vat: [],
        },
        deposit_due: 0,
        policy: { rules: {}, violations: [] },
        available: true,
        conflicts: [],
      }),
  };
}

async function open({ role = 'cashier', size = 'phone' }: { role?: Role; size?: WindowSize } = {}) {
  const instance = phase2Instance({ role, extra: findSpotRoutes() });
  const app = await renderApp({ session: SESSION, routes: instance.routes, size });
  await app.screen.findByText(/Anna · /);
  return { ...app, instance };
}

describe('Trova posto', () => {
  it.each<WindowSize>(['phone', 'tabletPortrait'])(
    'opens from the day map and shows the free spots row by row (%s)',
    async (size) => {
      const { screen, getPathname, network } = await open({ size });
      await act(async () => router.push('/map'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Trova posto' }));
      await waitFor(() => expect(getPathname()).toBe('/find-spot'));

      expect(
        await screen.findByText('1 postazione libera per tutto il soggiorno'),
      ).toBeOnTheScreen();
      expect(screen.getByText('Fila A')).toBeOnTheScreen();
      expect(screen.getByText('1 libera')).toBeOnTheScreen();
      expect(screen.getByText('Fila B')).toBeOnTheScreen();
      expect(screen.getByText('Nessun posto libero')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Prenota A1' })).toBeOnTheScreen();
      // Taken spots are not offered.
      expect(screen.queryByRole('button', { name: 'Prenota A2' })).toBeNull();

      const [first] = requestsTo(network.calls, 'GET', `${EST}/availability`);
      expect(Object.fromEntries(new URL(first!.url).searchParams)).toEqual({
        from: '2026-10-25',
        to: '2026-10-25',
        slots: 'FULL',
        map_id: 'm-1',
      });
    },
  );

  it('asks again for a week and shows the spots free only on some days', async () => {
    const { screen, network } = await open();
    await act(async () => router.push('/find-spot'));
    await screen.findByText('Fila A');
    await fireEvent.press(screen.getByRole('button', { name: '7 giorni' }));
    expect(await screen.findByText('Libere solo in parte: A3 (6 giorni su 7)')).toBeOnTheScreen();
    const last = requestsTo(network.calls, 'GET', `${EST}/availability`).at(-1)!;
    expect(new URL(last.url).searchParams.get('to')).toBe('2026-10-31');
  });

  it('hides the full rows when asked', async () => {
    const { screen } = await open();
    await act(async () => router.push('/find-spot'));
    await screen.findByText('Fila B');
    await fireEvent.press(screen.getByRole('button', { name: 'Solo file con posti liberi' }));
    await waitFor(() => expect(screen.queryByText('Fila B')).toBeNull());
    expect(screen.getByText('Fila A')).toBeOnTheScreen();
  });

  it('starts the new booking on the chosen spot with the same stay', async () => {
    const { screen, network } = await open();
    await act(async () => router.push('/find-spot'));
    await screen.findByText('Fila A');
    await fireEvent.press(screen.getByRole('button', { name: '7 giorni' }));
    await screen.findByText('Libere solo in parte: A3 (6 giorni su 7)');
    await fireEvent.press(screen.getByRole('button', { name: 'Prenota A1' }));

    expect(await screen.findByText('Prenota A1')).toBeOnTheScreen();
    await waitFor(() =>
      expect(requestsTo(network.calls, 'POST', `${EST}/bookings/quote`)).not.toHaveLength(0),
    );
    const quote = requestsTo(network.calls, 'POST', `${EST}/bookings/quote`).at(-1)!;
    expect((await quote.json()) as BookingCreate).toMatchObject({
      starts_on: '2026-10-25',
      ends_on: '2026-10-31',
      slots: 'FULL',
      lines: [expect.objectContaining({ spot_id: 's-1' })],
    });
  });

  it('opens from the phone home', async () => {
    const { screen, getPathname } = await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Trova posto' }));
    await waitFor(() => expect(getPathname()).toBe('/find-spot'));
  });

  it('is in the tablet navigation pane', async () => {
    const { screen, getPathname } = await open({ size: 'tabletPortrait' });
    await fireEvent.press(await screen.findByRole('link', { name: 'Trova posto' }));
    await waitFor(() => expect(getPathname()).toBe('/find-spot'));
  });

  it('says that it needs the connection and disables the map button offline', async () => {
    const { screen, connectivity } = await open();
    await act(async () => router.push('/map'));
    await screen.findByRole('button', { name: 'Trova posto' });
    await act(async () => connectivity.set(false));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trova posto' })).toBeDisabled());
    await act(async () => router.push('/find-spot'));
    expect(await screen.findByText('Serve la connessione')).toBeOnTheScreen();
  });

  describe('without bookings.write', () => {
    it('is not on the map, the home or the tablet pane', async () => {
      const { screen } = await open({ role: 'beach_staff', size: 'tabletPortrait' });
      expect(await screen.findByRole('link', { name: 'Mappa' })).toBeOnTheScreen();
      await waitFor(() => expect(screen.queryByRole('link', { name: 'Trova posto' })).toBeNull());
      expect(screen.queryByRole('button', { name: 'Trova posto' })).toBeNull();
      await act(async () => router.push('/map'));
      await screen.findByRole('radio', { name: 'Elenco' });
      expect(screen.queryByRole('button', { name: 'Trova posto' })).toBeNull();
    });

    it('refuses the screen opened directly', async () => {
      const { screen, network } = await open({ role: 'beach_staff' });
      await act(async () => router.push('/find-spot'));
      expect(await screen.findByText('Non consentito per il tuo ruolo.')).toBeOnTheScreen();
      expect(requestsTo(network.calls, 'GET', `${EST}/availability`)).toHaveLength(0);
    });
  });
});
