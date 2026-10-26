import { router } from 'expo-router';
import { act, fireEvent, waitFor, within } from 'expo-router/testing-library';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import type { MapDocument, OperationsDay, Permission, Role } from '@/api/types';
import { ROLE_PERMISSIONS } from '@/features/permissions/permissions';
import { DEVICE, json, meta, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { beachMap, mapDocument } from '@/test/map-fixtures';
import { operationalBooking, operationsDay, spot } from '@/test/operations-fixtures';
import { renderApp, type WindowSize } from '@/test/render-app';

const EST = `/api/admin/v1/establishments/${SESSION.establishmentId}`;

/** A1 free, A2 booked by Bianchi with a balance, B1 a season pass holder. */
const DAY = operationsDay({
  spots: [
    spot({ spot_id: 's-1', label: 'A1', status: 'free' }),
    spot({
      spot_id: 's-2',
      label: 'A2',
      status: 'booked',
      am_status: 'booked',
      pm_status: 'free',
      booking: operationalBooking({
        booking_id: 'b-2',
        code: 'AR-7K3Q9',
        customer_display_name: 'Niccolò Bianchi',
        occupant_label: 'Bianchi',
        version: 3,
      }),
    }),
    spot({
      spot_id: 's-3',
      label: 'B1',
      status: 'pass_holder',
      booking: operationalBooking({
        booking_id: 'b-3',
        code: 'AR-PASS1',
        is_season_pass: true,
        customer_display_name: 'Verdi Anna',
        occupant_label: 'Verdi',
        balance_due: 0,
        paid_amount: 3000,
      }),
    }),
  ],
});

interface Setup {
  role?: Role;
  permissions?: Permission[];
  day?: OperationsDay;
  documents?: MapDocument[];
  extra?: Record<string, Handler>;
}

function routes({
  role = 'cashier',
  permissions,
  day = DAY,
  documents = [mapDocument()],
  extra = {},
}: Setup = {}): Record<string, Handler> {
  const docs: Record<string, Handler> = {};
  for (const d of documents) docs[`GET ${EST}/maps/${d.map.id}`] = () => json(200, d);
  return {
    'GET /api/device/v1/self': () => json(200, { ...DEVICE, role }),
    'GET /api/admin/v1/meta': () => json(200, meta()),
    'GET /api/admin/v1/auth/me': () =>
      json(200, {
        principal_type: 'user',
        totp_enrolment_required: false,
        memberships: [
          {
            organization_id: 'org-1',
            establishment_id: SESSION.establishmentId,
            role,
            permissions: permissions ?? ROLE_PERMISSIONS[role],
          },
        ],
      }),
    [`GET ${EST}`]: () =>
      json(200, {
        id: SESSION.establishmentId,
        name: 'Lido Azzurro',
        timezone: 'Europe/Rome',
        organization_id: 'org-1',
      }),
    [`GET ${EST}/maps`]: () => json(200, { items: documents.map((d) => d.map) }),
    [`GET ${EST}/operations/day`]: () => json(200, day),
    [`GET ${EST}/bookings`]: () => json(200, { items: [] }),
    ...docs,
    ...extra,
  };
}

async function openMap(setup: Setup = {}, size: WindowSize = 'phone', connected = true) {
  const app = await renderApp({ session: SESSION, routes: routes(setup), size, connected });
  await app.screen.findByText(/Anna · /);
  await act(async () => router.push('/map'));
  return app;
}

describe('day map', () => {
  it.each<WindowSize>(['phone', 'tablet'])(
    'shows the map, the legend with labels and counts, and the controls (%s)',
    async (size) => {
      const { screen } = await openMap({}, size);
      const viewport = await screen.findByTestId('day-map-viewport');
      expect(viewport).toHaveProp(
        'accessibilityLabel',
        expect.stringContaining('Mappa Spiaggia con 3 postazioni'),
      );
      expect(await screen.findByLabelText('Libero: 1')).toBeOnTheScreen();
      expect(screen.getByLabelText('Da incassare: 1')).toBeOnTheScreen();
      expect(screen.getByLabelText('Abbonato: 1')).toBeOnTheScreen();
      // Every status is in the legend, even with no spot in it.
      expect(screen.getByLabelText('Prelazione rinnovo: 0')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Ingrandisci' })).toBeOnTheScreen();
      expect(screen.getByRole('radio', { name: /Oggi/ })).toBeChecked();
    },
  );

  it('zooms with the buttons and back to the whole map', async () => {
    const { screen } = await openMap();
    const viewport = await screen.findByTestId('day-map-viewport');
    expect(viewport).toHaveProp('accessibilityValue', { text: 'Zoom 100%' });
    await fireEvent.press(screen.getByRole('button', { name: 'Ingrandisci' }));
    expect(screen.getByTestId('day-map-viewport')).toHaveProp('accessibilityValue', {
      text: 'Zoom 160%',
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Mostra tutta la mappa' }));
    expect(screen.getByTestId('day-map-viewport')).toHaveProp('accessibilityValue', {
      text: 'Zoom 100%',
    });
  });

  it('commits a pinch zoom when the fingers lift', async () => {
    const { screen } = await openMap();
    await screen.findByTestId('day-map-viewport');
    const at = { focalX: 195, focalY: 232 };
    await act(async () => {
      fireGestureHandler(getByGestureTestId('day-map-pinch'), [
        { state: State.BEGAN, scale: 1, scaleChange: 1, ...at },
        { state: State.ACTIVE, scale: 1, scaleChange: 1, ...at },
        { state: State.ACTIVE, scale: 2, scaleChange: 2, ...at },
        { state: State.END, scale: 2, scaleChange: 1, ...at },
      ]);
    });
    await waitFor(() =>
      expect(screen.getByTestId('day-map-viewport')).toHaveProp('accessibilityValue', {
        text: 'Zoom 200%',
      }),
    );
  });

  it('opens the spot sheet with a tap on the map', async () => {
    const { screen } = await openMap();
    await screen.findByTestId('day-map-viewport');
    // Phone viewport 390 × 464 for a 600 × 448 map (sand + sea band of 48): A2 at (160, 100).
    const height = 844 * 0.55;
    const k = Math.min((390 - 24) / 600, (height - 24) / 448);
    const tx = 390 / 2 - 300 * k;
    const ty = height / 2 - 224 * k;
    await act(async () => {
      const at = { x: 160 * k + tx, y: 100 * k + ty };
      fireGestureHandler(getByGestureTestId('day-map-tap'), [
        { state: State.BEGAN, ...at },
        { state: State.ACTIVE, ...at },
        { state: State.END, ...at },
      ]);
    });
    expect(await screen.findByText('Postazione A2')).toBeOnTheScreen();
  });

  it.each<WindowSize>(['phone', 'tablet'])(
    'searches by customer and opens the sheet with booking and balance (%s)',
    async (size) => {
      const { screen } = await openMap({}, size);
      await fireEvent.changeText(await screen.findByLabelText('Cerca una postazione'), 'niccolo');
      expect(await screen.findByText('1 postazione trovata')).toBeOnTheScreen();
      await fireEvent.press(
        within(screen.getByTestId('day-map-results')).getByRole('button', {
          name: 'A2, Da incassare, Niccolò Bianchi',
        }),
      );
      const sheet = await screen.findByTestId('spot-sheet');
      expect(within(sheet).getByText('Postazione A2')).toBeOnTheScreen();
      expect(within(sheet).getByText('Niccolò Bianchi')).toBeOnTheScreen();
      expect(within(sheet).getByLabelText('Saldo: 20,00 €')).toBeOnTheScreen();
      expect(within(sheet).getByLabelText('Codice: AR-7K3Q9')).toBeOnTheScreen();
      // On a tablet the map stays visible beside the sheet.
      if (size === 'tablet') expect(screen.getByTestId('day-map-viewport')).toBeOnTheScreen();
    },
  );

  it.each<WindowSize>(['phone', 'tabletPortrait', 'tabletLandscape'])(
    'clears the search with the one in-field button (%s)',
    async (size) => {
      const { screen } = await openMap({}, size);
      const search = await screen.findByLabelText('Cerca una postazione');
      expect(screen.queryByRole('button', { name: 'Cancella la ricerca' })).toBeNull();
      await fireEvent.changeText(search, 'niccolo');
      expect(await screen.findByText('1 postazione trovata')).toBeOnTheScreen();
      expect(screen.getAllByRole('button', { name: 'Cancella la ricerca' })).toHaveLength(1);
      await fireEvent.press(screen.getByRole('button', { name: 'Cancella la ricerca' }));
      await waitFor(() => expect(screen.queryByText('1 postazione trovata')).toBeNull());
      expect(screen.getByLabelText('Cerca una postazione')).toHaveDisplayValue('');
      expect(screen.queryByRole('button', { name: 'Cancella la ricerca' })).toBeNull();
    },
  );

  it('searches by spot and booking code without customer names for a role without bookings.read', async () => {
    const { screen } = await openMap({ permissions: ['operations.run'] });
    const search = await screen.findByLabelText('Cerca una postazione');
    expect(search).toHaveProp('placeholder', 'Postazione o codice');
    await fireEvent.changeText(search, 'bianchi');
    expect(
      await screen.findByText('Nessuna postazione corrisponde alla ricerca'),
    ).toBeOnTheScreen();
    await fireEvent.changeText(search, '7k3');
    await fireEvent.press(await screen.findByRole('button', { name: 'A2, Da incassare' }));
    const sheet = await screen.findByTestId('spot-sheet');
    expect(within(sheet).queryByText('Niccolò Bianchi')).toBeNull();
  });

  it('checks in through the offline queue with its idempotency key and the booking version', async () => {
    let done = false;
    const checkIn = jest.fn(() => {
      done = true;
      return json(200, {});
    });
    const after = operationsDay({
      spots: DAY.spots.map((s) =>
        s.spot_id === 's-2'
          ? {
              ...s,
              status: 'checked_in',
              am_status: 'checked_in',
              booking: { ...s.booking!, status: 'checked_in' },
            }
          : s,
      ),
    });
    const { screen, network } = await openMap({
      role: 'beach_staff',
      extra: {
        [`POST ${EST}/bookings/b-2/check-in`]: checkIn,
        [`GET ${EST}/operations/day`]: () => json(200, done ? after : DAY),
      },
    });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Elenco' }));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'A2, Da incassare, Niccolò Bianchi' }),
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Check-in' }));
    expect(await screen.findByText('Check-in registrato per AR-7K3Q9.')).toBeOnTheScreen();
    await waitFor(() => expect(checkIn).toHaveBeenCalledTimes(1));
    const sent = network.calls.find((r) => new URL(r.url).pathname.endsWith('/check-in'));
    expect(sent?.headers.get('If-Match')).toBe('"3"');
    expect(sent?.headers.get('Idempotency-Key')).toBeTruthy();
    // The cached day shows the check-in at once: the action is gone.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Check-in' })).toBeNull());
  });

  it('releases the day of a pass holder after a confirmation', async () => {
    const release = jest.fn(() => json(201, { items: [] }));
    const { screen, network } = await openMap({
      role: 'beach_staff',
      extra: { [`POST ${EST}/season-passes/b-3/releases`]: release },
    });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Elenco' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'B1, Abbonato, Verdi Anna' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Rilascia il giorno' }));
    expect(await screen.findByText('Rilasciare la postazione B1?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Rilascia' }));
    await waitFor(() => expect(release).toHaveBeenCalledTimes(1));
    const sent = network.calls.find((r) => new URL(r.url).pathname.endsWith('/releases'));
    expect(await sent?.clone().json()).toEqual({ dates: ['2026-10-25'], slots: 'FULL' });
  });

  it('blocks a free spot online, with the reason and the day shown', async () => {
    const block = jest.fn(() => json(201, { items: [] }));
    const { screen, network } = await openMap({
      role: 'manager',
      extra: { [`POST ${EST}/spot-blocks`]: block },
    });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Elenco' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'A1, Libero' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Blocca la postazione' }));
    await fireEvent.changeText(
      await screen.findByLabelText('Motivo (facoltativo)'),
      'Ombrellone rotto',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Blocca' }));
    expect(await screen.findByText('Postazione A1 bloccata.')).toBeOnTheScreen();
    const sent = network.calls.find((r) => new URL(r.url).pathname.endsWith('/spot-blocks'));
    expect(sent?.headers.get('Idempotency-Key')).toBeTruthy();
    expect(await sent?.clone().json()).toEqual({
      spot_ids: ['s-1'],
      starts_on: '2026-10-25',
      ends_on: '2026-10-25',
      slots: 'FULL',
      reason: 'Ombrellone rotto',
    });
  });

  it('shows "non consentito" when the server refuses a block', async () => {
    const { screen } = await openMap({
      role: 'manager',
      extra: { [`POST ${EST}/spot-blocks`]: () => problem(403, 'forbidden') },
    });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Elenco' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'A1, Libero' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Blocca la postazione' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Blocca' }));
    expect(await screen.findByText('Non consentito per il tuo ruolo.')).toBeOnTheScreen();
  });

  it('offers blocks only while the instance is reachable', async () => {
    const { screen, connectivity } = await openMap({ role: 'manager' });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Elenco' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'A1, Libero' }));
    expect(await screen.findByRole('button', { name: 'Blocca la postazione' })).toBeEnabled();
    await act(async () => connectivity.set(false));
    expect(await screen.findByText(/Bloccare e sbloccare richiede/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Blocca la postazione' })).toBeDisabled();
  });

  it('hides every action from a viewer', async () => {
    const { screen } = await openMap({ role: 'viewer' });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Elenco' }));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'A2, Da incassare, Niccolò Bianchi' }),
    );
    expect(await screen.findByText(/Accesso in sola lettura/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Check-in' })).toBeNull();
  });

  it('follows the slot: A2 is free in the afternoon', async () => {
    const { screen } = await openMap();
    expect(await screen.findByLabelText('Libero: 1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Pomeriggio' }));
    expect(await screen.findByLabelText('Libero: 2')).toBeOnTheScreen();
  });

  it('lists every spot in natural order in the list view', async () => {
    const { screen } = await openMap();
    await fireEvent.press(await screen.findByRole('radio', { name: 'Elenco' }));
    const list = await screen.findByTestId('day-map-list');
    const names = within(list)
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel as string);
    expect(names).toEqual([
      'A1, Libero',
      'A2, Da incassare, Niccolò Bianchi',
      'B1, Abbonato, Verdi Anna',
    ]);
  });

  it('switches between the maps of the establishment, keeping the slot', async () => {
    const second = mapDocument({
      map: beachMap({ id: 'm-2', name: { it: 'Terrazza' }, sort_order: 1 }),
      spots: [mapDocument().spots[0]!].map((s) => ({
        ...s,
        id: 's-9',
        map_id: 'm-2',
        label: 'T1',
      })),
      decorations: [],
    });
    const { screen } = await openMap({ documents: [mapDocument(), second] });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Pomeriggio' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Terrazza' }));
    expect(await screen.findByTestId('day-map-viewport')).toHaveProp(
      'accessibilityLabel',
      expect.stringContaining('Mappa Terrazza con 1 postazione'),
    );
    // The slot chosen on the first map is kept.
    expect(screen.getByRole('radio', { name: 'Pomeriggio' })).toBeChecked();
  });

  it('says the day is closed', async () => {
    const { screen } = await openMap({ day: operationsDay({ closed: true, spots: [] }) });
    expect(await screen.findByText('Giorno di chiusura o fuori stagione.')).toBeOnTheScreen();
  });

  it('explains that maps are drawn in the panel when there are none', async () => {
    const { screen } = await openMap({ documents: [] });
    expect(await screen.findByText('Nessuna mappa')).toBeOnTheScreen();
  });
});

describe('day map: spot sheet placement on tablets', () => {
  type Element = ReturnType<Awaited<ReturnType<typeof openMap>>['screen']['getByTestId']>;
  const ancestors = (node: Element) => {
    const chain: Element[] = [];
    for (let n = node.parent as Element | null; n; n = n.parent as Element | null) chain.push(n);
    return chain;
  };

  it.each([
    // 834 − rail 64 − sheet 384 < 420: no room for the map beside the sheet.
    ['tabletPortrait', 'under the map, in its column', false],
    ['tabletLandscape', 'beside the map column', true],
  ] as const)('opens the sheet at %s %s', async (size, _where, beside) => {
    const { screen } = await openMap({}, size);
    await fireEvent.changeText(await screen.findByLabelText('Cerca una postazione'), 'niccolo');
    await fireEvent.press(
      within(await screen.findByTestId('day-map-results')).getByRole('button', {
        name: 'A2, Da incassare, Niccolò Bianchi',
      }),
    );
    const sheet = await screen.findByTestId('spot-sheet');
    expect(within(sheet).getByText('Postazione A2')).toBeOnTheScreen();
    const viewport = screen.getByTestId('day-map-viewport');
    expect(viewport).toBeOnTheScreen();

    // The closest element holding both: the map column when the sheet is
    // under the map (the sheet sits in a wrapper of that column), the row
    // of column and sheet when it is beside (the sheet is a direct child).
    const ofViewport = ancestors(viewport);
    const common = ancestors(sheet).find((a) => ofViewport.includes(a))!;
    expect(sheet.parent === common).toBe(beside);
    const column = beside ? ofViewport.find((a) => a.parent === common)! : common;
    // The toolbar is in the map column either way; the sheet only when under the map.
    expect(within(column).getByLabelText('Cerca una postazione')).toBeOnTheScreen();
    expect(within(column).queryByTestId('spot-sheet') !== null).toBe(!beside);
  });
});
