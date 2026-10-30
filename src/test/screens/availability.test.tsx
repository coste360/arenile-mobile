import { router } from 'expo-router';
import { act, fireEvent, waitFor, within } from 'expo-router/testing-library';

import type { AvailabilityResult, BookingCreate, Role } from '@/api/types';
import { QUEUE_KEY } from '@/features/offline/queue';
import type { OfflineOperation } from '@/features/offline/types';
import { json, networkDown, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { beachMap, mapDocument, mapSpot } from '@/test/map-fixtures';
import { EST, extra, pack, PHASE2_MAP, phase2Instance, requestsTo } from '@/test/phase-2-routes';
import { renderApp, type WindowSize } from '@/test/render-app';

type SpotAvailability = NonNullable<AvailabilityResult['zones'][number]['spots']>[number];

const DAY_MS = 86_400_000;

/** Map of phase 2: A1 free, A2 taken, A3 taken on the last day of the stay, B1 (row B) taken. */
function availabilityOf(url: URL, overrides: Partial<AvailabilityResult> = {}): AvailabilityResult {
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
    slots: (url.searchParams.get('slots') ?? 'FULL') as AvailabilityResult['slots'],
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
    ...overrides,
  };
}

function availabilityRoutes(extraRoutes: Record<string, Handler> = {}): Record<string, Handler> {
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
    ...extraRoutes,
  };
}

async function open({
  role = 'cashier',
  size = 'phone',
  extra: extraRoutes = {},
  offlineData,
}: {
  role?: Role;
  size?: WindowSize;
  extra?: Record<string, Handler>;
  offlineData?: Record<string, string>;
} = {}) {
  const instance = phase2Instance({ role, extra: availabilityRoutes(extraRoutes) });
  const app = await renderApp({
    session: SESSION,
    routes: instance.routes,
    size,
    offlineData,
  });
  await app.screen.findByText(/Anna · /);
  return { ...app, instance };
}

/** Second map of the establishment, with one free spot P1 in row P. */
const POOL_MAP = mapDocument({
  map: beachMap({ id: 'm-2', name: { it: 'Piscina' }, sort_order: 1 }),
  spots: [mapSpot({ id: 'p-1', map_id: 'm-2', label: 'P1', row_label: 'P' })],
});
const TWO_MAPS: Record<string, Handler> = {
  [`GET ${EST}/maps`]: () => json(200, { items: [PHASE2_MAP.map, POOL_MAP.map] }),
  [`GET ${EST}/maps/m-2`]: () => json(200, POOL_MAP),
  [`GET ${EST}/availability`]: (r) => {
    const url = new URL(r.url);
    if (url.searchParams.get('map_id') !== 'm-2') return json(200, availabilityOf(url));
    return json(
      200,
      availabilityOf(url, {
        zones: [
          {
            zone_id: 'z-1',
            code: 'P',
            assignment_mode: 'seat',
            capacity: 1,
            available: 1,
            spots: [
              { spot_id: 'p-1', label: 'P1', status: 'available', free_days: 1, total_days: 1 },
            ],
          },
        ],
      }),
    );
  },
};

const paramsOf = (r: Request) => Object.fromEntries(new URL(r.url).searchParams);

describe('Disponibilità', () => {
  it.each<WindowSize>(['phone', 'tabletPortrait', 'tabletLandscape', 'tabletSplitView'])(
    'opens from the day map and shows the free spots row by row (%s)',
    async (size) => {
      const { screen, getPathname, network } = await open({ size });
      await act(async () => router.push('/map'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Disponibilità' }));
      await waitFor(() => expect(getPathname()).toBe('/availability'));

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
      expect(paramsOf(first!)).toEqual({
        from: '2026-10-25',
        to: '2026-10-25',
        slots: 'FULL',
        map_id: 'm-1',
      });
    },
  );

  it("starts from the map's day and map", async () => {
    const { screen, network } = await open({ extra: TWO_MAPS });
    await act(async () => router.push('/map'));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Piscina' }));
    await fireEvent.press(await screen.findByRole('radio', { name: /^Domani/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Disponibilità' }));

    expect(await screen.findByText('Fila P')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Piscina', selected: true })).toBeOnTheScreen();
    const [first] = requestsTo(network.calls, 'GET', `${EST}/availability`);
    expect(paramsOf(first!)).toMatchObject({ from: '2026-10-26', map_id: 'm-2' });
  });

  it('chooses among the maps, without the previous map on screen meanwhile', async () => {
    let answerPool: () => void = () => {};
    const poolAnswered = new Promise<void>((resolve) => {
      answerPool = resolve;
    });
    const { screen, network } = await open({
      extra: {
        ...TWO_MAPS,
        [`GET ${EST}/availability`]: async (r) => {
          if (new URL(r.url).searchParams.get('map_id') === 'm-2') await poolAnswered;
          return TWO_MAPS[`GET ${EST}/availability`]!(r);
        },
      },
    });
    await act(async () => router.push('/availability'));
    await screen.findByText('Fila A');
    await fireEvent.press(screen.getByRole('button', { name: 'Piscina' }));

    await waitFor(() => expect(screen.queryByText('Fila A')).toBeNull());
    expect(screen.getByText('Cerco le postazioni libere…')).toBeOnTheScreen();
    await act(async () => answerPool());
    expect(await screen.findByText('Fila P')).toBeOnTheScreen();
    expect(
      requestsTo(network.calls, 'GET', `${EST}/availability`).map((r) => paramsOf(r).map_id),
    ).toEqual(['m-1', 'm-2']);
  });

  it('asks again for a week and shows the spots free only on some days', async () => {
    const { screen, network } = await open();
    await act(async () => router.push('/availability'));
    await screen.findByText('Fila A');
    await fireEvent.press(screen.getByRole('button', { name: '7 giorni' }));
    expect(await screen.findByText('Libere solo in parte: A3 (6 giorni su 7)')).toBeOnTheScreen();
    const last = requestsTo(network.calls, 'GET', `${EST}/availability`).at(-1)!;
    expect(paramsOf(last).to).toBe('2026-10-31');
  });

  it('does not book a spot of the previous answer while the new one is on its way', async () => {
    let answerWeek: () => void = () => {};
    const weekAnswered = new Promise<void>((resolve) => {
      answerWeek = resolve;
    });
    const { screen, network } = await open({
      extra: {
        [`GET ${EST}/availability`]: async (r) => {
          const url = new URL(r.url);
          if (url.searchParams.get('to') !== url.searchParams.get('from')) await weekAnswered;
          return json(200, availabilityOf(url));
        },
      },
    });
    await act(async () => router.push('/availability'));
    await screen.findByText('Fila A');
    await fireEvent.press(screen.getByRole('button', { name: '7 giorni' }));

    // The day's answer stays on screen, dimmed: A1 cannot be booked for the week yet.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Prenota A1' })).toBeDisabled());
    expect(screen.getByText('Aggiorno la disponibilità…')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Prenota A1' }));
    expect(requestsTo(network.calls, 'POST', `${EST}/bookings/quote`)).toHaveLength(0);

    await act(async () => answerWeek());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Prenota A1' })).toBeEnabled());
    expect(screen.getByText('1 postazione libera per tutto il soggiorno')).toBeOnTheScreen();
  });

  it('hides the full rows when asked', async () => {
    const { screen } = await open();
    await act(async () => router.push('/availability'));
    await screen.findByText('Fila B');
    await fireEvent.press(screen.getByRole('button', { name: 'Solo file con posti liberi' }));
    await waitFor(() => expect(screen.queryByText('Fila B')).toBeNull());
    expect(screen.getByText('Fila A')).toBeOnTheScreen();
  });

  it.each([
    ['the whole day', 'FULL', undefined],
    ['the morning', 'AM', 'Mattina'],
  ] as const)(
    'starts the new booking on the chosen spot with the same stay (%s)',
    async (_, slot, chip) => {
      const { screen, network } = await open();
      await act(async () => router.push('/availability'));
      await screen.findByText('Fila A');
      await fireEvent.press(screen.getByRole('button', { name: '7 giorni' }));
      if (chip) await fireEvent.press(screen.getByRole('button', { name: chip }));
      await waitFor(() =>
        expect(
          paramsOf(requestsTo(network.calls, 'GET', `${EST}/availability`).at(-1)!),
        ).toMatchObject({ to: '2026-10-31', slots: slot }),
      );
      await waitFor(() => expect(screen.getByRole('button', { name: 'Prenota A1' })).toBeEnabled());
      await fireEvent.press(screen.getByRole('button', { name: 'Prenota A1' }));

      expect(await screen.findByText('Prenota A1')).toBeOnTheScreen();
      await waitFor(() =>
        expect(requestsTo(network.calls, 'POST', `${EST}/bookings/quote`)).not.toHaveLength(0),
      );
      const quote = requestsTo(network.calls, 'POST', `${EST}/bookings/quote`).at(-1)!;
      expect((await quote.json()) as BookingCreate).toMatchObject({
        starts_on: '2026-10-25',
        ends_on: '2026-10-31',
        slots: slot,
        lines: [expect.objectContaining({ spot_id: 's-1' })],
      });
    },
  );

  it('lists the closed days left out of the stay', async () => {
    const { screen } = await open({
      extra: {
        [`GET ${EST}/availability`]: (r) =>
          json(200, availabilityOf(new URL(r.url), { closed_dates: ['2026-10-26'] })),
      },
    });
    await act(async () => router.push('/availability'));
    expect(await screen.findByText(/^Giorni di chiusura esclusi: /)).toBeOnTheScreen();
    expect(screen.getByText('Fila A')).toBeOnTheScreen();
  });

  it('says that the establishment is closed for the whole stay', async () => {
    const { screen } = await open({
      extra: {
        [`GET ${EST}/availability`]: (r) =>
          json(200, availabilityOf(new URL(r.url), { closed_dates: ['2026-10-25'] })),
      },
    });
    await act(async () => router.push('/availability'));
    expect(
      await screen.findByText('Lo stabilimento è chiuso per tutto il soggiorno.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Fila A')).toBeNull();
  });

  it('shows an error with a retry', async () => {
    let failures = 1;
    const { screen } = await open({
      extra: {
        [`GET ${EST}/availability`]: (r) => {
          if (failures-- > 0) return problem(503, 'internal_error');
          return json(200, availabilityOf(new URL(r.url)));
        },
      },
    });
    await act(async () => router.push('/availability'));
    expect(await screen.findByText('Disponibilità non caricata')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByText('Fila A')).toBeOnTheScreen();
  });

  it('says "non consentito" when the server refuses the availability', async () => {
    const { screen } = await open({
      extra: { [`GET ${EST}/availability`]: () => problem(403, 'forbidden') },
    });
    await act(async () => router.push('/availability'));
    expect(await screen.findByText('Non consentito per il tuo ruolo.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Riprova' })).toBeNull();
  });

  it('says that there is no map', async () => {
    const { screen, network } = await open({
      extra: { [`GET ${EST}/maps`]: () => json(200, { items: [] }) },
    });
    await act(async () => router.push('/availability'));
    expect(await screen.findByText('Nessuna mappa')).toBeOnTheScreen();
    expect(requestsTo(network.calls, 'GET', `${EST}/availability`)).toHaveLength(0);
  });

  describe('zones sold as a whole or by quantity', () => {
    const withZones: Record<string, Handler> = {
      [`GET ${EST}/availability`]: (r) => {
        const answer = availabilityOf(new URL(r.url));
        return json(200, {
          ...answer,
          zones: [
            ...answer.zones,
            {
              zone_id: 'z-lawn',
              code: 'prato',
              assignment_mode: 'zone',
              capacity: 20,
              available: 6,
              spots: [],
            },
            {
              zone_id: 'z-beds',
              code: 'lettini',
              assignment_mode: 'quantity',
              capacity: 40,
              available: 0,
            },
          ],
        });
      },
      [`GET ${EST}/zones`]: () =>
        json(200, {
          items: [{ id: 'z-lawn', code: 'prato', name: { it: 'Prato', en: 'Lawn' } }],
        }),
    };

    it.each<WindowSize>(['phone', 'tabletPortrait'])(
      'shows each zone after the rows with its free places (%s)',
      async (size) => {
        const { screen } = await open({ size, extra: withZones });
        await act(async () => router.push('/availability'));
        await screen.findByText('Fila A');

        const lawn = await screen.findByTestId('availability-zone-z-lawn');
        expect(within(lawn).getByText('Prato')).toBeOnTheScreen();
        expect(within(lawn).getByText('Posto nella zona')).toBeOnTheScreen();
        expect(within(lawn).getByText('6 posti liberi su 20')).toBeOnTheScreen();
        // Without a name in the zones list, the code.
        const beds = screen.getByTestId('availability-zone-z-beds');
        expect(within(beds).getByText('lettini')).toBeOnTheScreen();
        expect(within(beds).getByText('A quantità')).toBeOnTheScreen();
        expect(within(beds).getByText('Nessun posto libero')).toBeOnTheScreen();
        // Informational: a zone is not booked from here.
        expect(within(lawn).queryByRole('button')).toBeNull();
      },
    );

    it('hides the full zones with the full rows', async () => {
      const { screen } = await open({ extra: withZones });
      await act(async () => router.push('/availability'));
      await screen.findByTestId('availability-zone-z-beds');
      await fireEvent.press(screen.getByRole('button', { name: 'Solo file con posti liberi' }));
      await waitFor(() => expect(screen.queryByTestId('availability-zone-z-beds')).toBeNull());
      expect(screen.getByTestId('availability-zone-z-lawn')).toBeOnTheScreen();
    });
  });

  describe('attributes of the spots', () => {
    const withAttributes: Record<string, Handler> = {
      [`GET ${EST}/maps/m-1`]: () =>
        json(200, {
          ...PHASE2_MAP,
          spots: PHASE2_MAP.spots.map((spot) =>
            spot.id === 's-1'
              ? { ...spot, attributes: ['Prima fila', 'ombra'] }
              : spot.id === 's-3'
                ? { ...spot, attributes: ['prima fila'] }
                : spot.id === 's-4'
                  ? { ...spot, attributes: ['Ombra'] }
                  : spot,
          ),
        }),
      // Every spot free, so that the filter shows in the counts.
      [`GET ${EST}/availability`]: (r) => {
        const answer = availabilityOf(new URL(r.url));
        return json(200, {
          ...answer,
          zones: answer.zones.map((z) => ({
            ...z,
            spots: z.spots!.map((sp) => ({ ...sp, status: 'available', free_days: 1 })),
          })),
        });
      },
    };

    it.each<WindowSize>(['phone', 'tabletPortrait'])(
      'keeps only the spots with all the chosen attributes (%s)',
      async (size) => {
        const { screen } = await open({ size, extra: withAttributes });
        await act(async () => router.push('/availability'));
        expect(
          await screen.findByText('4 postazioni libere per tutto il soggiorno'),
        ).toBeOnTheScreen();
        expect(screen.getByText('Caratteristiche (tutte quelle scelte)')).toBeOnTheScreen();
        // Once each regardless of case, as first written by the manager.
        expect(screen.getAllByRole('button', { name: /^prima fila$/i })).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: /^ombra$/i })).toHaveLength(1);

        await fireEvent.press(screen.getByRole('button', { name: 'Prima fila' }));
        expect(
          await screen.findByText('2 postazioni libere per tutto il soggiorno'),
        ).toBeOnTheScreen();
        expect(screen.getByRole('button', { name: 'Prenota A1' })).toBeOnTheScreen();
        expect(screen.getByRole('button', { name: 'Prenota A3' })).toBeOnTheScreen();
        expect(screen.queryByText('Fila B')).toBeNull();

        await fireEvent.press(screen.getByRole('button', { name: 'ombra' }));
        expect(
          await screen.findByText('1 postazione libera per tutto il soggiorno'),
        ).toBeOnTheScreen();
        expect(screen.getByRole('button', { name: 'Prenota A1' })).toBeOnTheScreen();
        expect(screen.queryByRole('button', { name: 'Prenota A3' })).toBeNull();
      },
    );

    it('says when no spot has all the chosen attributes', async () => {
      const { screen } = await open({
        extra: {
          ...withAttributes,
          [`GET ${EST}/maps/m-1`]: () =>
            json(200, {
              ...PHASE2_MAP,
              spots: PHASE2_MAP.spots.map((spot) =>
                spot.id === 's-1'
                  ? { ...spot, attributes: ['prima fila'] }
                  : spot.id === 's-4'
                    ? { ...spot, attributes: ['ombra'] }
                    : spot,
              ),
            }),
        },
      });
      await act(async () => router.push('/availability'));
      await fireEvent.press(await screen.findByRole('button', { name: 'prima fila' }));
      await fireEvent.press(screen.getByRole('button', { name: 'ombra' }));
      expect(
        await screen.findByText('Nessuna postazione con tutte queste caratteristiche.'),
      ).toBeOnTheScreen();
    });

    it('shows no attribute chips when no spot has attributes', async () => {
      const { screen } = await open();
      await act(async () => router.push('/availability'));
      await screen.findByText('Fila A');
      expect(screen.queryByText('Caratteristiche (tutte quelle scelte)')).toBeNull();
    });
  });

  it('opens from the phone home', async () => {
    const { screen, getPathname } = await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Disponibilità' }));
    await waitFor(() => expect(getPathname()).toBe('/availability'));
  });

  it.each<WindowSize>(['tabletPortrait', 'tabletLandscape', 'tabletSplitView'])(
    'is in the tablet navigation pane (%s)',
    async (size) => {
      const { screen, getPathname } = await open({ size });
      await fireEvent.press(await screen.findByRole('link', { name: 'Disponibilità' }));
      await waitFor(() => expect(getPathname()).toBe('/availability'));
    },
  );

  it('says that it needs the connection and disables the map button offline', async () => {
    const { screen, connectivity } = await open();
    await act(async () => router.push('/map'));
    await screen.findByRole('button', { name: 'Disponibilità' });
    await act(async () => connectivity.set(false));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Disponibilità' })).toBeDisabled(),
    );
    await act(async () => router.push('/availability'));
    expect(await screen.findByText('Serve la connessione')).toBeOnTheScreen();
  });

  it('keeps the connection indicator beside the map button offline with pending operations', async () => {
    const pending = {
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
    } as OfflineOperation;
    const { screen, connectivity } = await open({
      // The payment does not get through: it stays in the queue.
      extra: { [`POST ${EST}/bookings/b-1/payments`]: networkDown },
      offlineData: { [QUEUE_KEY]: JSON.stringify([pending]) },
    });
    await act(async () => router.push('/map'));
    await screen.findByRole('button', { name: 'Disponibilità' });
    await act(async () => connectivity.set(false));
    expect(await screen.findByRole('button', { name: /1 operazione in attesa/ })).toBeOnTheScreen();
    const button = screen.getByRole('button', { name: 'Disponibilità' });
    expect(button).toBeDisabled();
    // Icon only on phones: no label text in the header.
    expect(screen.queryByText('Disponibilità')).toBeNull();
  });

  describe('without bookings.write', () => {
    it('is not on the map, the home or the tablet pane', async () => {
      const { screen } = await open({ role: 'beach_staff', size: 'tabletPortrait' });
      expect(await screen.findByRole('link', { name: 'Mappa' })).toBeOnTheScreen();
      await waitFor(() => expect(screen.queryByRole('link', { name: 'Disponibilità' })).toBeNull());
      expect(screen.queryByRole('button', { name: 'Disponibilità' })).toBeNull();
      await act(async () => router.push('/map'));
      await screen.findByRole('radio', { name: 'Elenco' });
      expect(screen.queryByRole('button', { name: 'Disponibilità' })).toBeNull();
    });

    it('refuses the screen opened directly', async () => {
      const { screen, network } = await open({ role: 'beach_staff' });
      await act(async () => router.push('/availability'));
      expect(await screen.findByText('Non consentito per il tuo ruolo.')).toBeOnTheScreen();
      expect(requestsTo(network.calls, 'GET', `${EST}/availability`)).toHaveLength(0);
    });
  });
});
