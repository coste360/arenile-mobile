import { router } from 'expo-router';
import { act, fireEvent, waitFor } from 'expo-router/testing-library';

import type { OperationsDay } from '@/api/types';
import { QUEUE_KEY } from '@/features/offline/queue';
import type { OfflineOperation } from '@/features/offline/types';
import { DEVICE, json, meta, networkDown, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import {
  bookingDetail,
  bookingSummary,
  operationalBooking,
  operationsDay,
  spot,
} from '@/test/operations-fixtures';
import { renderApp, type WindowSize } from '@/test/render-app';

// The camera is native: the fake exposes the scan callback to the tests.
let mockOnScanned: ((result: { data: string }) => void) | undefined;
jest.mock('expo-camera', () => {
  const { View } = jest.requireActual('react-native');
  return {
    CameraView: (props: {
      onBarcodeScanned?: (r: { data: string }) => void;
      accessibilityLabel?: string;
    }) => {
      mockOnScanned = props.onBarcodeScanned;
      return <View accessibilityLabel={props.accessibilityLabel} />;
    },
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  };
});

const EST = `/api/admin/v1/establishments/${SESSION.establishmentId}`;
const TOKEN = 'MFRGGZDFMZTWQ2LKNNWG23TPOA';

interface Options {
  role?: string;
  day?: OperationsDay;
  routes?: Record<string, Handler>;
}

/** An instance that answers, with today's day and bookings; `down()` takes it away. */
function instance({ role = 'cashier', day = operationsDay(), routes = {} }: Options = {}) {
  let unreachable = false;
  const up =
    (h: Handler): Handler =>
    (r) =>
      unreachable ? networkDown(r) : h(r);
  const base: Record<string, Handler> = {
    'GET /api/device/v1/self': () => json(200, { ...DEVICE, role }),
    'GET /api/admin/v1/meta': () =>
      json(200, meta({ features: ['bookings', 'cash', 'season_passes'] })),
    [`GET ${EST}`]: () =>
      json(200, {
        id: SESSION.establishmentId,
        name: 'Lido Azzurro',
        timezone: 'Europe/Rome',
        organization_id: 'org-1',
      }),
    [`GET ${EST}/maps`]: () => json(200, { items: [] }),
    [`GET ${EST}/operations/day`]: (r) =>
      new URL(r.url).searchParams.get('date') === '2026-10-25'
        ? json(200, day)
        : json(200, operationsDay({ date: '2026-10-26', spots: [] })),
    [`GET ${EST}/bookings`]: (r) => {
      const q = new URL(r.url).searchParams.get('q');
      if (q) return json(200, { items: q === 'AR-7K3Q9' ? [bookingSummary()] : [] });
      return json(200, { items: [] });
    },
    ...routes,
  };
  return {
    routes: Object.fromEntries(Object.entries(base).map(([k, h]) => [k, up(h)])),
    down: () => {
      unreachable = true;
    },
  };
}

const queued = (offlineStore: { snapshot(): Record<string, string> }): OfflineOperation[] =>
  JSON.parse(offlineStore.snapshot()[QUEUE_KEY] ?? '[]');

async function openOperations(screen: Awaited<ReturnType<typeof renderApp>>['screen']) {
  expect(await screen.findByText(/Anna · /)).toBeOnTheScreen();
  await act(async () => router.push('/operations'));
  expect(await screen.findByText('Postazioni di oggi')).toBeOnTheScreen();
}

describe('operations hub', () => {
  it('opens from the phone home header', async () => {
    const { routes } = instance();
    const { screen, getPathname } = await renderApp({ session: SESSION, routes });
    expect(await screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Operazioni' }));
    expect(await screen.findByText('Scansiona un QR code')).toBeOnTheScreen();
    expect(getPathname()).toBe('/operations');
  });

  it('opens from the tablet navigation pane', async () => {
    const { routes } = instance();
    const { screen, getPathname } = await renderApp({ session: SESSION, routes, size: 'tablet' });
    expect(await screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Operazioni' }));
    expect(await screen.findByText('Scansiona un QR code')).toBeOnTheScreen();
    expect(getPathname()).toBe('/operations');
  });

  it.each<WindowSize>(['phone', 'tablet'])(
    "lists and searches today's spots (%s)",
    async (size) => {
      const { routes } = instance({
        day: operationsDay({
          spots: [
            spot({ booking: operationalBooking() }),
            spot({ spot_id: 's-2', label: 'B7', status: 'free' }),
          ],
        }),
      });
      const { screen } = await renderApp({ session: SESSION, routes, size });
      await openOperations(screen);
      expect(await screen.findByRole('link', { name: 'A1, Prenotata' })).toBeOnTheScreen();
      expect(screen.getByRole('link', { name: 'B7, Libera' })).toBeOnTheScreen();

      await fireEvent.changeText(screen.getByLabelText('Cerca una postazione'), 'b');
      expect(screen.queryByRole('link', { name: 'A1, Prenotata' })).toBeNull();
      await fireEvent.press(screen.getByRole('link', { name: 'B7, Libera' }));
      expect(await screen.findByText('Blocca la postazione')).toBeOnTheScreen();
    },
  );

  it('asks for a code before searching', async () => {
    const { routes } = instance();
    const { screen } = await renderApp({ session: SESSION, routes });
    await openOperations(screen);
    await fireEvent.press(screen.getByRole('button', { name: 'Cerca' }));
    expect(await screen.findByText('Inserisci un codice.')).toBeOnTheScreen();
  });
});

describe('check-in by code', () => {
  it('finds a booking of the cached day offline and queues its check-in', async () => {
    const { routes, down } = instance();
    const { screen, offlineStore, connectivity } = await renderApp({ session: SESSION, routes });
    await openOperations(screen);
    expect(await screen.findByRole('link', { name: 'A1, Prenotata' })).toBeOnTheScreen();
    down();
    await act(async () => connectivity.set(false));

    await fireEvent.changeText(
      screen.getByLabelText('Codice della prenotazione o numero del biglietto'),
      'ar-7k3q9',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Cerca' }));
    expect(await screen.findByText('Prenotazione AR-7K3Q9')).toBeOnTheScreen();
    expect(screen.getByText('Rossi Mario')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Fai il check-in' }));

    expect(await screen.findByText(/Salvato sul dispositivo/)).toBeOnTheScreen();
    // The cached copy changed at once: no second check-in can be queued.
    expect(screen.getAllByText('Check-in fatto').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Fai il check-in' })).toBeNull();
    await waitFor(() =>
      expect(queued(offlineStore)).toEqual([
        expect.objectContaining({
          kind: 'check_in',
          bookingId: 'b-1',
          ifMatch: '"3"',
          label: 'A1 · AR-7K3Q9',
          status: 'pending',
        }),
      ]),
    );
  });

  it('asks the instance for a booking that is not cached and sends the check-in', async () => {
    const checkIn = jest.fn(() => json(200, bookingDetail({ status: 'checked_in', version: 4 })));
    const { routes } = instance({
      day: operationsDay({ spots: [] }),
      routes: { [`POST ${EST}/bookings/b-1/check-in`]: checkIn },
    });
    const { screen, network } = await renderApp({ session: SESSION, routes });
    await openOperations(screen);

    await fireEvent.changeText(
      screen.getByLabelText('Codice della prenotazione o numero del biglietto'),
      'AR-7K3Q9',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Cerca' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Fai il check-in' }));

    await waitFor(() => expect(checkIn).toHaveBeenCalledTimes(1));
    const sent = network.calls.find((r) => new URL(r.url).pathname.endsWith('/check-in'))!;
    expect(sent.headers.get('If-Match')).toBe('"3"');
    expect(sent.headers.get('Idempotency-Key')).toBeTruthy();
    expect(await screen.findByText('Registrato.')).toBeOnTheScreen();
  });

  it('says when no booking has the code', async () => {
    const { routes } = instance();
    const { screen } = await renderApp({ session: SESSION, routes });
    await openOperations(screen);
    await fireEvent.changeText(
      screen.getByLabelText('Codice della prenotazione o numero del biglietto'),
      'AR-NOPE1',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Cerca' }));
    expect(
      await screen.findByText('Nessuna prenotazione o biglietto con questo codice.'),
    ).toBeOnTheScreen();
  });

  it('admits a typed ticket number only after confirmation, as a manual entry', async () => {
    const gate = jest.fn(() =>
      json(200, { outcome: 'admitted', ticket: { number_label: '#037' } }),
    );
    const { routes } = instance({ routes: { [`POST ${EST}/entry-gate/check-in`]: gate } });
    const { screen, network } = await renderApp({ session: SESSION, routes });
    await openOperations(screen);
    await fireEvent.changeText(
      screen.getByLabelText('Codice della prenotazione o numero del biglietto'),
      '37',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Cerca' }));
    expect(await screen.findByText('Biglietto numero 37')).toBeOnTheScreen();
    expect(gate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: "Registra l'ingresso" }));
    expect(await screen.findByText('Ingresso registrato')).toBeOnTheScreen();
    const sent = network.calls.find((r) =>
      new URL(r.url).pathname.endsWith('/entry-gate/check-in'),
    );
    expect(await sent?.clone().json()).toEqual({ code: '37', manual: true });
  });
});

describe('check-in by QR', () => {
  async function openScanner(options: Options = {}) {
    const ctx = instance(options);
    const app = await renderApp({ session: SESSION, routes: ctx.routes });
    expect(await app.screen.findByText(/Anna · /)).toBeOnTheScreen();
    await act(async () => router.push('/operations/scan'));
    expect(
      await app.screen.findByText('Inquadra il QR della prenotazione o del biglietto.'),
    ).toBeOnTheScreen();
    return { ...ctx, ...app };
  }

  const scan = async (data: string) => {
    await act(async () => mockOnScanned?.({ data }));
  };

  it('shows the booking of a booking QR with its check-in', async () => {
    const { screen } = await openScanner();
    await scan('ARENILE:AR-7K3Q9');
    expect(await screen.findByText('Prenotazione AR-7K3Q9')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fai il check-in' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Scansiona il prossimo' })).toBeOnTheScreen();
  });

  it('admits an entry ticket at once', async () => {
    const gate = jest.fn(() => json(200, { outcome: 'admitted' }));
    const { screen, network } = await openScanner({
      routes: {
        [`GET ${EST}/tickets/by-code/${TOKEN}`]: () =>
          json(200, { id: 't-1', kind: 'entry', booking_id: 'b-9', number_label: '#037' }),
        [`POST ${EST}/entry-gate/check-in`]: gate,
      },
    });
    await scan(TOKEN);
    expect(await screen.findByText('Ingresso registrato')).toBeOnTheScreen();
    expect(screen.getByText("Biglietto d'ingresso #037")).toBeOnTheScreen();
    const sent = network.calls.find((r) =>
      new URL(r.url).pathname.endsWith('/entry-gate/check-in'),
    );
    expect(await sent?.clone().json()).toEqual({ code: TOKEN });
  });

  it('says when a ticket was already used', async () => {
    const { screen } = await openScanner({
      routes: {
        [`GET ${EST}/tickets/by-code/${TOKEN}`]: () =>
          json(200, { id: 't-1', kind: 'entry', booking_id: 'b-9', number_label: '#037' }),
        [`POST ${EST}/entry-gate/check-in`]: () => json(200, { outcome: 'already_entered' }),
      },
    });
    await scan(TOKEN);
    expect(
      await screen.findByText('Già entrato: il biglietto è già stato usato'),
    ).toBeOnTheScreen();
  });

  it('does not admit entries for a role without operations.run', async () => {
    const gate = jest.fn(() => json(200, { outcome: 'admitted' }));
    const { screen } = await openScanner({
      role: 'viewer',
      routes: {
        [`GET ${EST}/tickets/by-code/${TOKEN}`]: () =>
          json(200, { id: 't-1', kind: 'entry', booking_id: 'b-9', number_label: '#037' }),
        [`POST ${EST}/entry-gate/check-in`]: gate,
      },
    });
    await scan(TOKEN);
    expect(
      await screen.findByText('Registrare gli ingressi non è consentito per il tuo ruolo.'),
    ).toBeOnTheScreen();
    expect(gate).not.toHaveBeenCalled();
  });

  it('needs the connection for a ticket QR', async () => {
    const { screen, down, connectivity } = await openScanner();
    down();
    await act(async () => connectivity.set(false));
    await scan(TOKEN);
    expect(await screen.findByText(/Serve la connessione: questo codice/)).toBeOnTheScreen();
  });

  it('ignores a QR that is not Arenile and keeps scanning', async () => {
    const { screen } = await openScanner();
    await scan('https://example.com/menu');
    expect(await screen.findByText('Questo QR code non è di Arenile.')).toBeOnTheScreen();
    await scan('ARENILE:AR-7K3Q9');
    expect(await screen.findByText('Prenotazione AR-7K3Q9')).toBeOnTheScreen();
  });

  it('shows "non consentito" when the instance refuses the lookup', async () => {
    const { screen } = await openScanner({
      day: operationsDay({ spots: [] }),
      routes: { [`GET ${EST}/bookings`]: () => problem(403, 'forbidden') },
    });
    await scan('ARENILE:AR-7K3Q9');
    expect(await screen.findByText('Non consentito per il tuo ruolo.')).toBeOnTheScreen();
  });
});

describe('booking operations', () => {
  async function openBooking(options: Options & { size?: WindowSize } = {}) {
    const ctx = instance({
      ...options,
      routes: {
        [`GET ${EST}/bookings/b-1`]: () => json(200, bookingDetail()),
        [`GET ${EST}/cash-sessions/current`]: () =>
          json(200, {
            session: { status: 'open' },
            movements: [],
            payments: [],
            totals_by_method: {},
          }),
        ...options.routes,
      },
    });
    const app = await renderApp({ session: SESSION, routes: ctx.routes, size: options.size });
    expect(await app.screen.findByText(/Anna · /)).toBeOnTheScreen();
    await act(async () => router.push('/operations/booking/b-1'));
    expect(await app.screen.findByText('Rossi Mario')).toBeOnTheScreen();
    return { ...ctx, ...app };
  }

  it.each<WindowSize>(['phone', 'tablet'])(
    'offers check-in, cash and notes to a cashier (%s)',
    async (size) => {
      const { screen } = await openBooking({ size });
      expect(screen.getByRole('button', { name: 'Fai il check-in' })).toBeOnTheScreen();
      expect(await screen.findByText('Da saldare: 20,00 €')).toBeOnTheScreen();
      expect(screen.getByText('Note interne')).toBeOnTheScreen();
      expect(screen.queryByText('Rilascio del giorno')).toBeNull();
    },
  );

  it('hides cash and notes from the beach staff', async () => {
    const { screen } = await openBooking({ role: 'beach_staff' });
    expect(screen.getByRole('button', { name: 'Fai il check-in' })).toBeOnTheScreen();
    expect(screen.queryByText('Incasso in contanti')).toBeNull();
    expect(screen.queryByText('Note interne')).toBeNull();
  });

  it('only shows the booking to a read-only role', async () => {
    const { screen } = await openBooking({ role: 'viewer' });
    expect(
      screen.getByText('Il tuo ruolo può consultare la prenotazione ma non fare operazioni.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Fai il check-in' })).toBeNull();
  });

  it('collects cash after confirmation, prefilled with the balance', async () => {
    const payment = jest.fn(() => json(201, {}));
    const { screen, network } = await openBooking({
      routes: { [`POST ${EST}/bookings/b-1/payments`]: payment },
    });
    expect(await screen.findByDisplayValue('20,00')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Importo'), '12,50');
    await fireEvent.press(screen.getByRole('button', { name: 'Incassa' }));
    expect(await screen.findByText('Incassare 12,50 € in contanti?')).toBeOnTheScreen();
    expect(payment).not.toHaveBeenCalled();

    const buttons = screen.getAllByRole('button', { name: 'Incassa' });
    await fireEvent.press(buttons[buttons.length - 1]!);

    await waitFor(() => expect(payment).toHaveBeenCalledTimes(1));
    const sent = network.calls.find((r) => new URL(r.url).pathname.endsWith('/payments'))!;
    expect(await sent.clone().json()).toEqual({ amount: 1250, method: 'cash' });
    expect(sent.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('refuses an amount above the balance', async () => {
    const { screen } = await openBooking();
    await fireEvent.changeText(await screen.findByLabelText('Importo'), '25');
    await fireEvent.press(screen.getByRole('button', { name: 'Incassa' }));
    expect(await screen.findByText("L'importo supera il saldo da pagare.")).toBeOnTheScreen();
  });

  it('says the cash desk is closed instead of offering cash', async () => {
    const { screen } = await openBooking({
      routes: { [`GET ${EST}/cash-sessions/current`]: () => problem(404, 'not_found') },
    });
    expect(await screen.findByText(/La cassa è chiusa/)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Importo')).toBeNull();
  });

  it('queues a note', async () => {
    const note = jest.fn(() => json(200, bookingDetail({ notes_internal: 'Arriva alle 11' })));
    const { screen, network } = await openBooking({
      routes: { [`POST ${EST}/bookings/b-1/notes`]: note },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Aggiungi la nota' }));
    expect(await screen.findByText('Scrivi il testo della nota.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Nuova nota'), '  Arriva alle 11 ');
    await fireEvent.press(screen.getByRole('button', { name: 'Aggiungi la nota' }));
    await waitFor(() => expect(note).toHaveBeenCalledTimes(1));
    const sent = network.calls.find((r) => new URL(r.url).pathname.endsWith('/notes'))!;
    expect(await sent.clone().json()).toEqual({ text: 'Arriva alle 11', visibility: 'internal' });
  });

  it('releases a season pass half-day after confirmation', async () => {
    const release = jest.fn(() => json(201, { items: [] }));
    const pass = bookingDetail({
      is_season_pass: true,
      starts_on: '2026-06-01',
      ends_on: '2026-10-31',
      balance_due: 0,
      paid_amount: 3000,
    });
    const { screen, network } = await openBooking({
      routes: {
        [`GET ${EST}/bookings/b-1`]: () => json(200, pass),
        [`POST ${EST}/season-passes/b-1/releases`]: release,
      },
    });
    expect(await screen.findByText('Rilascio del giorno')).toBeOnTheScreen();
    expect(screen.getByText('Saldata: nulla da incassare.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Pomeriggio'));
    await fireEvent.press(screen.getByRole('button', { name: 'Rilascia' }));
    expect(await screen.findByText(/Rilasciare dom 25 ott/)).toBeOnTheScreen();
    const buttons = screen.getAllByRole('button', { name: 'Rilascia' });
    await fireEvent.press(buttons[buttons.length - 1]!);

    await waitFor(() => expect(release).toHaveBeenCalledTimes(1));
    const sent = network.calls.find((r) => new URL(r.url).pathname.endsWith('/releases'))!;
    expect(await sent.clone().json()).toEqual({ dates: ['2026-10-25'], slots: 'PM' });
  });

  it('works offline from the cached day when the detail is not cached', async () => {
    const { routes, down } = instance();
    const { screen, connectivity } = await renderApp({ session: SESSION, routes });
    await openOperations(screen);
    expect(await screen.findByRole('link', { name: 'A1, Prenotata' })).toBeOnTheScreen();
    down();
    await act(async () => connectivity.set(false));
    await act(async () => router.push('/operations/booking/b-1'));
    expect(await screen.findByText('Rossi Mario')).toBeOnTheScreen();
    expect(screen.getByText(/Senza connessione non si sa se la cassa è aperta/)).toBeOnTheScreen();
  });
});

describe('spot operations', () => {
  async function openSpot(day: OperationsDay, routes: Record<string, Handler> = {}) {
    const ctx = instance({ day, routes });
    const app = await renderApp({ session: SESSION, routes: ctx.routes });
    expect(await app.screen.findByText(/Anna · /)).toBeOnTheScreen();
    await act(async () => router.push('/operations/spot/s-2'));
    return { ...ctx, ...app };
  }

  const freeDay = operationsDay({
    spots: [
      spot({ booking: operationalBooking() }),
      spot({ spot_id: 's-2', label: 'B7', status: 'free' }),
    ],
  });

  it('blocks a free spot with a stable idempotency key', async () => {
    const block = jest.fn(() => json(201, { items: [] }));
    const { screen, network } = await openSpot(freeDay, { [`POST ${EST}/spot-blocks`]: block });
    expect(await screen.findByText('Blocca la postazione')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Oggi e domani'));
    await fireEvent.press(screen.getByText('Mattina'));
    await fireEvent.changeText(screen.getByLabelText('Motivo (facoltativo)'), 'Ombrellone rotto');
    await fireEvent.press(screen.getByRole('button', { name: 'Blocca' }));

    await waitFor(() => expect(block).toHaveBeenCalledTimes(1));
    const sent = network.calls.find((r) => new URL(r.url).pathname.endsWith('/spot-blocks'))!;
    expect(await sent.clone().json()).toEqual({
      spot_ids: ['s-2'],
      starts_on: '2026-10-25',
      ends_on: '2026-10-26',
      slots: 'AM',
      reason: 'Ombrellone rotto',
    });
    expect(sent.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('explains a spot that is no longer free', async () => {
    const { screen } = await openSpot(freeDay, {
      [`POST ${EST}/spot-blocks`]: () => problem(409, 'spot_unavailable'),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Blocca' }));
    expect(
      await screen.findByText('La postazione non è libera nel periodo scelto.'),
    ).toBeOnTheScreen();
  });

  it('does not offer blocks offline', async () => {
    const { screen, down, connectivity } = await openSpot(freeDay);
    expect(await screen.findByRole('button', { name: 'Blocca' })).toBeOnTheScreen();
    down();
    await act(async () => connectivity.set(false));
    expect(await screen.findByText(/richiede l'istanza raggiungibile/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Blocca' })).toBeNull();
  });

  it('unblocks a blocked spot after confirmation', async () => {
    const unblock = jest.fn(() => new Response(null, { status: 204 }));
    const { screen } = await openSpot(
      operationsDay({
        spots: [
          spot({
            spot_id: 's-2',
            label: 'B7',
            status: 'blocked',
            block_id: 'blk-1',
            block_reason: 'Ombrellone rotto',
          }),
        ],
      }),
      { [`DELETE ${EST}/spot-blocks/blk-1`]: unblock },
    );
    expect(await screen.findByText('Ombrellone rotto')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sblocca la postazione' }));
    expect(await screen.findByText('Sbloccare la postazione B7?')).toBeOnTheScreen();
    const buttons = screen.getAllByRole('button', { name: 'Sblocca la postazione' });
    await fireEvent.press(buttons[buttons.length - 1]!);
    await waitFor(() => expect(unblock).toHaveBeenCalledTimes(1));
  });

  it('hides blocks from a role without operations.run', async () => {
    const ctx = instance({ role: 'viewer', day: freeDay });
    const { screen } = await renderApp({ session: SESSION, routes: ctx.routes });
    expect(await screen.findByText(/Anna · /)).toBeOnTheScreen();
    await act(async () => router.push('/operations/spot/s-2'));
    expect(await screen.findByText('Postazione B7')).toBeOnTheScreen();
    expect(screen.queryByText('Blocca la postazione')).toBeNull();
  });
});
