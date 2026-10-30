import { router } from 'expo-router';
import { act, fireEvent, waitFor, within } from 'expo-router/testing-library';
import { BackHandler } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import type { MapDocument, OperationsDay, Permission, Role } from '@/api/types';
import { ROLE_PERMISSIONS } from '@/features/permissions/permissions';
import { datesRequested, OTHER_DAY, pickDay } from '@/test/day-picker';
import { DEVICE, json, meta, networkDown, problem, type Handler } from '@/test/fake-fetch';
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

  it.each<WindowSize>(['phone', 'tablet', 'tabletLandscape'])(
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
      // Beside the map (landscape) the map stays visible; otherwise the sheet covers it
      // (1024 portrait: 1024 − nav 288 − sheet 384 < 420).
      if (size === 'tabletLandscape') {
        expect(screen.getByTestId('day-map-viewport')).toBeOnTheScreen();
      } else {
        expect(screen.queryByTestId('day-map-viewport')).toBeNull();
      }
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

  it.each<WindowSize>(['phone', 'tablet'])(
    'shows only the days on this spot of a stay split across spots (%s)',
    async (size) => {
      const split = operationsDay({
        spots: [
          spot({
            spot_id: 's-2',
            label: 'A2',
            status: 'booked',
            booking: operationalBooking({
              booking_id: 'b-2',
              customer_display_name: 'Niccolò Bianchi',
              starts_on: '2026-10-20',
              ends_on: '2026-10-30',
              segment_starts_on: '2026-10-24',
              segment_ends_on: '2026-10-27',
            }),
          }),
        ],
      });
      const { screen } = await openMap({ day: split }, size);
      await fireEvent.press(await screen.findByRole('radio', { name: 'Elenco' }));
      await fireEvent.press(await screen.findByRole('button', { name: /^A2, / }));
      expect(await screen.findByText(/24 ott.* – .*27 ott/)).toBeOnTheScreen();
      expect(screen.queryByText(/20 ott/)).toBeNull();
    },
  );

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
    expect(
      await screen.findByText('Oggi è un giorno di chiusura o fuori stagione.'),
    ).toBeOnTheScreen();
  });

  it('explains that maps are drawn in the panel when there are none', async () => {
    const { screen } = await openMap({ documents: [] });
    expect(await screen.findByText('Nessuna mappa')).toBeOnTheScreen();
  });
});

describe('day map: spot sheet placement', () => {
  type Element = ReturnType<Awaited<ReturnType<typeof openMap>>['screen']['getByTestId']>;
  const ancestors = (node: Element) => {
    const chain: Element[] = [];
    for (let n = node.parent as Element | null; n; n = n.parent as Element | null) chain.push(n);
    return chain;
  };

  async function openA2(size: WindowSize) {
    const app = await openMap({}, size);
    await fireEvent.changeText(await app.screen.findByLabelText('Cerca una postazione'), 'niccolo');
    await fireEvent.press(
      within(await app.screen.findByTestId('day-map-results')).getByRole('button', {
        name: 'A2, Da incassare, Niccolò Bianchi',
      }),
    );
    const sheet = await app.screen.findByTestId('spot-sheet');
    expect(within(sheet).getByText('Postazione A2')).toBeOnTheScreen();
    return { ...app, sheet };
  }

  it('opens the sheet beside the map column at tabletLandscape', async () => {
    const { screen, sheet } = await openA2('tabletLandscape');
    const viewport = screen.getByTestId('day-map-viewport');
    expect(viewport).toBeOnTheScreen();
    // The closest element holding both is the row of map column and sheet.
    const ofViewport = ancestors(viewport);
    const common = ancestors(sheet).find((a) => ofViewport.includes(a))!;
    expect(sheet.parent).toBe(common);
    const column = ofViewport.find((a) => a.parent === common)!;
    expect(within(column).getByLabelText('Cerca una postazione')).toBeOnTheScreen();
    expect(within(column).queryByTestId('spot-sheet')).toBeNull();
  });

  it.each<WindowSize>(['phone', 'tabletPortrait', 'tabletSplitView'])(
    'covers the map with the sheet, hidden from screen readers but still mounted, at %s',
    async (size) => {
      const { screen } = await openA2(size);
      // Map, toolbar and legend are hidden from accessibility under the sheet…
      expect(screen.queryByTestId('day-map-viewport')).toBeNull();
      expect(screen.queryByLabelText('Cerca una postazione')).toBeNull();
      expect(screen.queryByLabelText('Libero: 1')).toBeNull();
      // …but stay mounted (the map keeps its zoom for when the sheet closes).
      expect(screen.getByTestId('day-map-viewport', { includeHiddenElements: true })).toBeTruthy();
      expect(screen.getByTestId('spot-sheet').parent).toHaveProp('accessibilityViewIsModal', true);

      await fireEvent.press(screen.getByRole('button', { name: 'Chiudi la scheda' }));

      expect(await screen.findByTestId('day-map-viewport')).toBeOnTheScreen();
      expect(screen.getByLabelText('Cerca una postazione')).toBeOnTheScreen();
      expect(screen.getByLabelText('Libero: 1')).toBeOnTheScreen();
      expect(screen.queryByTestId('spot-sheet')).toBeNull();
    },
  );

  it('closes a covering sheet with the Android back button, and only the sheet', async () => {
    type Listener = Parameters<typeof BackHandler.addEventListener>[1];
    const listeners: Listener[] = [];
    const spy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((event, listener) => {
        if (event === 'hardwareBackPress') listeners.push(listener);
        return {
          remove: () => {
            listeners.splice(listeners.indexOf(listener), 1);
          },
        };
      });
    try {
      const { screen, getPathname } = await openMap();
      await screen.findByTestId('day-map-viewport');
      const baseline = listeners.length;
      await fireEvent.changeText(screen.getByLabelText('Cerca una postazione'), 'niccolo');
      await fireEvent.press(
        within(await screen.findByTestId('day-map-results')).getByRole('button', {
          name: 'A2, Da incassare, Niccolò Bianchi',
        }),
      );
      await screen.findByTestId('spot-sheet');
      expect(listeners).toHaveLength(baseline + 1);

      let handled: boolean | null | undefined;
      await act(async () => {
        handled = listeners.at(-1)!({} as Parameters<Listener>[0]);
      });
      expect(handled).toBe(true);
      expect(screen.queryByTestId('spot-sheet')).toBeNull();
      expect(await screen.findByTestId('day-map-viewport')).toBeOnTheScreen();
      expect(getPathname()).toBe('/map');
      // Closed, the back button is the navigator's again.
      expect(listeners).toHaveLength(baseline);
    } finally {
      spy.mockRestore();
    }
  });

  it('leaves the Android back button alone when the sheet is beside the map', async () => {
    const add = jest.spyOn(BackHandler, 'addEventListener');
    try {
      const { screen } = await openMap({}, 'tabletLandscape');
      await screen.findByTestId('day-map-viewport');
      const before = add.mock.calls.length;
      await fireEvent.changeText(screen.getByLabelText('Cerca una postazione'), 'niccolo');
      await fireEvent.press(
        within(await screen.findByTestId('day-map-results')).getByRole('button', {
          name: 'A2, Da incassare, Niccolò Bianchi',
        }),
      );
      await screen.findByTestId('spot-sheet');
      expect(add.mock.calls.length).toBe(before);
    } finally {
      add.mockRestore();
    }
  });
});

describe('day map: days beyond today and tomorrow (ADR 0014)', () => {
  const DAY_PATH = `${EST}/operations/day`;

  it.each<WindowSize>(['phone', 'tabletPortrait', 'tabletLandscape'])(
    'loads a day chosen in the calendar and shows its date in the third segment (%s)',
    async (size) => {
      const { screen, network } = await openMap({}, size);
      expect(await screen.findByLabelText('Libero: 1')).toBeOnTheScreen();
      expect(screen.getByRole('radio', { name: 'Scegli un altro giorno' })).not.toBeChecked();

      await pickDay(screen, '2026-11-03');

      await waitFor(() => expect(datesRequested(network.calls, DAY_PATH)).toContain('2026-11-03'));
      const other = await screen.findByRole('radio', { name: 'mar 3 nov, cambia giorno' });
      expect(other).toBeChecked();
      expect(within(other).getByText('mar 3 nov')).toBeOnTheScreen();
      expect(screen.getByRole('radio', { name: /^Oggi/ })).not.toBeChecked();
      expect(screen.queryByTestId('day-picker-calendar')).toBeNull();
    },
  );

  it('offers no pass day release beyond tomorrow: the release is queued offline', async () => {
    const { screen } = await openMap({ role: 'beach_staff' });
    expect(await screen.findByLabelText('Libero: 1')).toBeOnTheScreen();
    await pickDay(screen, '2026-10-30');
    expect(await screen.findByRole('radio', { name: /cambia giorno$/ })).toBeChecked();
    await fireEvent.press(await screen.findByRole('radio', { name: 'Elenco' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'B1, Abbonato, Verdi Anna' }));
    const sheet = await screen.findByTestId('spot-sheet');
    expect(within(sheet).getByText('Postazione B1')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Rilascia il giorno' })).toBeNull();
  });

  it('goes back to "Oggi" when today\'s date is chosen in the calendar', async () => {
    const { screen } = await openMap();
    expect(await screen.findByLabelText('Libero: 1')).toBeOnTheScreen();
    await pickDay(screen, '2026-11-03');
    expect(await screen.findByRole('radio', { name: 'mar 3 nov, cambia giorno' })).toBeChecked();

    await pickDay(screen, '2026-10-25');

    expect(await screen.findByRole('radio', { name: /^Oggi/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: OTHER_DAY })).toHaveProp(
      'accessibilityLabel',
      'Scegli un altro giorno',
    );
  });

  it('says a day outside today and tomorrow is online only, and today still shows offline', async () => {
    const window = new Set(['2026-10-25', '2026-10-26']);
    const { screen, connectivity } = await openMap({
      extra: {
        [`GET ${DAY_PATH}`]: (r) =>
          window.has(new URL(r.url).searchParams.get('date') ?? '')
            ? json(200, DAY)
            : networkDown(r),
      },
    });
    expect(await screen.findByLabelText('Libero: 1')).toBeOnTheScreen();
    await act(async () => connectivity.set(false));

    await pickDay(screen, '2026-11-03');
    expect(await screen.findByText('Giorno disponibile solo online')).toBeOnTheScreen();
    expect(screen.getByText(/Sul dispositivo restano solo oggi e domani/)).toBeOnTheScreen();
    expect(screen.queryByText(/Stati del giorno non disponibili/)).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: /^Oggi/ }));
    expect(await screen.findByLabelText('Libero: 1')).toBeOnTheScreen();
    expect(screen.queryByText('Giorno disponibile solo online')).toBeNull();
  });

  it('says tomorrow is a closure day', async () => {
    const { screen } = await openMap({
      extra: {
        [`GET ${DAY_PATH}`]: (r) =>
          new URL(r.url).searchParams.get('date') === '2026-10-26'
            ? json(200, operationsDay({ date: '2026-10-26', closed: true, spots: [] }))
            : json(200, DAY),
      },
    });
    expect(await screen.findByLabelText('Libero: 1')).toBeOnTheScreen();
    expect(screen.queryByText('Stabilimento chiuso')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: /^Domani/ }));
    expect(
      await screen.findByText('Domani è un giorno di chiusura o fuori stagione.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Stabilimento chiuso')).toBeOnTheScreen();
  });
});

describe('day map: opened on a spot (/map?spot=…&map=…)', () => {
  /** A second map "Terrazza" with T1 (s-9), free today. */
  const TERRACE = mapDocument({
    map: beachMap({ id: 'm-2', name: { it: 'Terrazza' }, sort_order: 1 }),
    spots: [mapDocument().spots[0]!].map((s) => ({ ...s, id: 's-9', map_id: 'm-2', label: 'T1' })),
    decorations: [],
  });
  const TWO_MAPS_DAY = operationsDay({
    spots: [...DAY.spots, spot({ spot_id: 's-9', map_id: 'm-2', label: 'T1', status: 'free' })],
  });

  it.each<WindowSize>(['phone', 'tablet', 'tabletLandscape'])(
    'a tap on a free spot of the spots list opens its sheet on the map (%s)',
    async (size) => {
      const { screen, getPathname, getSearchParams } = await renderApp({
        session: SESSION,
        routes: routes(),
        size,
      });
      await screen.findByText(/Anna · /);
      await act(async () => router.push('/spots?status=free'));
      const row = await screen.findByTestId('spot-row-s-1');
      expect(row).toHaveProp('role', 'link');
      expect(row).toHaveProp('accessibilityHint', 'Apre la postazione sulla mappa');

      await fireEvent.press(row);

      await waitFor(() => expect(getPathname()).toBe('/map'));
      expect(getSearchParams()).toEqual(expect.objectContaining({ spot: 's-1', map: 'm-1' }));
      const sheet = await screen.findByTestId('spot-sheet');
      expect(within(sheet).getByText('Postazione A1')).toBeOnTheScreen();
      // Beside the map only in landscape; elsewhere the sheet covers the map.
      if (size === 'tabletLandscape') {
        expect(screen.getByTestId('day-map-viewport')).toBeOnTheScreen();
      } else {
        expect(screen.queryByTestId('day-map-viewport')).toBeNull();
        await fireEvent.press(within(sheet).getByRole('button', { name: 'Chiudi la scheda' }));
        expect(await screen.findByTestId('day-map-viewport')).toBeOnTheScreen();
      }
    },
  );

  it('selects the spot of the second map, choosing that map', async () => {
    const { screen } = await renderApp({
      session: SESSION,
      routes: routes({ documents: [mapDocument(), TERRACE], day: TWO_MAPS_DAY }),
    });
    await screen.findByText(/Anna · /);
    await act(async () => router.push('/map?spot=s-9&map=m-2'));

    const sheet = await screen.findByTestId('spot-sheet');
    expect(within(sheet).getByText('Postazione T1')).toBeOnTheScreen();
    // The sheet covers the map on a phone: close it to see which map is shown.
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Chiudi la scheda' }));
    expect(await screen.findByRole('radio', { name: 'Terrazza' })).toBeChecked();
    expect(screen.getByTestId('day-map-viewport')).toHaveProp(
      'accessibilityLabel',
      expect.stringContaining('Mappa Terrazza con 1 postazione'),
    );
  });

  it('a tap on a spot of the second map in the spots list opens that map', async () => {
    const { screen } = await renderApp({
      session: SESSION,
      routes: routes({ documents: [mapDocument(), TERRACE], day: TWO_MAPS_DAY }),
    });
    await screen.findByText(/Anna · /);
    await act(async () => router.push('/spots?status=free'));
    // With two maps each row names its map.
    const row = await screen.findByRole('link', { name: 'T1, Terrazza, Libera' });
    await fireEvent.press(row);

    const sheet = await screen.findByTestId('spot-sheet');
    expect(within(sheet).getByText('Postazione T1')).toBeOnTheScreen();
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Chiudi la scheda' }));
    expect(await screen.findByRole('radio', { name: 'Terrazza' })).toBeChecked();
  });

  it('does not reopen the route spot when the user comes back to its map', async () => {
    const { screen } = await renderApp({
      session: SESSION,
      routes: routes({ documents: [mapDocument(), TERRACE], day: TWO_MAPS_DAY }),
    });
    await screen.findByText(/Anna · /);
    await act(async () => router.push('/map?spot=s-1&map=m-1'));
    const sheet = await screen.findByTestId('spot-sheet');
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Chiudi la scheda' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Terrazza' }));
    await screen.findByLabelText(/Mappa Terrazza/);
    await fireEvent.press(screen.getByRole('radio', { name: 'Spiaggia' }));
    await screen.findByLabelText(/Mappa Spiaggia/, { includeHiddenElements: true });
    // The user closed A1's sheet: coming back to its map must not open it again.
    expect(screen.queryByTestId('spot-sheet')).toBeNull();
    expect(screen.getByLabelText(/Mappa Spiaggia/)).toBeOnTheScreen();
  });

  it('selects the spot only once: closing the sheet keeps it closed', async () => {
    const { screen } = await renderApp({ session: SESSION, routes: routes() });
    await screen.findByText(/Anna · /);
    await act(async () => router.push('/map?spot=s-1&map=m-1'));
    expect(await screen.findByTestId('spot-sheet')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Chiudi la scheda' }));
    await waitFor(() => expect(screen.queryByTestId('spot-sheet')).toBeNull());
    // A new slot reloads the day's spots: the route's spot is not selected again.
    await fireEvent.press(screen.getByRole('radio', { name: 'Pomeriggio' }));
    expect(await screen.findByLabelText('Libero: 2')).toBeOnTheScreen();
    expect(screen.queryByTestId('spot-sheet')).toBeNull();
  });
});
