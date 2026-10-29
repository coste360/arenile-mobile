import { router, type Href } from 'expo-router';
import { act, fireEvent, waitFor, within } from 'expo-router/testing-library';

import { QUEUE_KEY } from '@/features/offline/queue';
import type { OfflineOperation } from '@/features/offline/types';
import { formatDayLabel } from '@/lib/calendar';
import { datesRequested, pickDay } from '@/test/day-picker';
import { dayRoutes, EST } from '@/test/day-routes';
import { json, networkDown, problem } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { bookingDetail, customer } from '@/test/operations-fixtures';
import { renderApp, setWindow, type RenderAppOptions, type WindowSize } from '@/test/render-app';

async function open(path: string, options: RenderAppOptions = {}) {
  const app = await renderApp({ session: SESSION, routes: dayRoutes(), ...options });
  expect(await app.screen.findByText('Lido Azzurro')).toBeOnTheScreen();
  await act(async () => router.push(path as Href));
  return app;
}

const rowIds = (screen: Awaited<ReturnType<typeof open>>['screen']) =>
  screen
    .queryAllByTestId(/^booking-row-/)
    .map((r) => String(r.props.testID).replace('booking-row-', ''));

describe('bookings of the day', () => {
  it('lists the day by spot, without cancelled bookings', async () => {
    const { screen } = await open('/bookings');
    expect(await screen.findByText('3 prenotazioni')).toBeOnTheScreen();
    expect(rowIds(screen)).toEqual(['b-1', 'b-2', 'b-3']);
    expect(screen.getByRole('button', { name: 'Tutte, 3', selected: true })).toBeOnTheScreen();
    const row = screen.getByTestId('booking-row-b-1');
    expect(row.props.accessibilityLabel).toMatch(
      /^A1, Rossi Mario, AR-7K3Q9, Confermata, Da saldare 20,00\s€$/,
    );
    // Season pass and online badges, never colour alone.
    expect(screen.getByText('Abbonamento')).toBeOnTheScreen();
    expect(screen.getByText('Online')).toBeOnTheScreen();
  });

  it('searches by customer without accents, by code and by spot', async () => {
    const { screen } = await open('/bookings');
    const search = await screen.findByLabelText('Cerca prenotazioni');
    await fireEvent.changeText(search, 'nicolo');
    await waitFor(() => expect(rowIds(screen)).toEqual(['b-2']));
    await fireEvent.changeText(search, '5p4z');
    await waitFor(() => expect(rowIds(screen)).toEqual(['b-3']));
    await fireEvent.changeText(search, 'zz9');
    expect(await screen.findByText('Nessun risultato')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Azzera filtri' }));
    await waitFor(() => expect(rowIds(screen)).toEqual(['b-1', 'b-2', 'b-3']));
  });

  it('filters by channel, sorts by balance and shows cancelled on request', async () => {
    const { screen } = await open('/bookings');
    await screen.findByText('3 prenotazioni');
    await fireEvent.press(screen.getByRole('button', { name: 'Altri filtri' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Online' }));
    await waitFor(() => expect(rowIds(screen)).toEqual(['b-2']));
    await fireEvent.press(screen.getByRole('button', { name: 'Cassa' }));
    await waitFor(() => expect(rowIds(screen)).toEqual(['b-1', 'b-3']));
    await fireEvent.press(screen.getByRole('button', { name: 'Tutti i canali' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Saldo' }));
    await waitFor(() => expect(rowIds(screen)).toEqual(['b-3', 'b-1', 'b-2']));

    await fireEvent.press(
      screen.getByRole('button', { name: 'Mostra anche cancellate e scadute' }),
    );
    await waitFor(() => expect(rowIds(screen)).toEqual(['b-3', 'b-1', 'b-4', 'b-2']));
    expect(screen.getByRole('button', { name: 'Nascondi filtri' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Nascondi filtri' }));
    expect(screen.getByRole('button', { name: 'Altri filtri (2)' })).toBeOnTheScreen();
  });

  it('filters season pass holders', async () => {
    const { screen } = await open('/bookings');
    await fireEvent.press(await screen.findByRole('button', { name: 'Abbonati, 1' }));
    await waitFor(() => expect(rowIds(screen)).toEqual(['b-3']));
  });

  it("switches to tomorrow's bookings", async () => {
    const { screen } = await open('/bookings');
    await screen.findByText('3 prenotazioni');
    await fireEvent.press(screen.getByRole('radio', { name: /^Domani/ }));
    expect(await screen.findByText('Nessuna prenotazione')).toBeOnTheScreen();
  });

  it('says "non consentito" when the instance refuses the list', async () => {
    const routes = dayRoutes();
    routes[`GET ${EST}/bookings`] = () => problem(403, 'forbidden');
    const { screen } = await open('/bookings', { routes });
    expect(await screen.findByText('Non consentito per il tuo ruolo.')).toBeOnTheScreen();
  });
});

describe('booking sheet', () => {
  it('opens from the list on a phone with spot, stay, customer, amounts and history', async () => {
    const { screen, getPathname } = await open('/bookings');
    await fireEvent.press(await screen.findByTestId('booking-row-b-1'));
    await waitFor(() => expect(getPathname()).toBe('/bookings/b-1'));

    expect(await screen.findByText('Postazione e periodo')).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'AR-7K3Q9' })).toBeOnTheScreen();
    expect(screen.getByText('Pacchetto OMB-2L')).toBeOnTheScreen();
    expect(screen.getByLabelText('Periodo: dom 25 ott · 1 giorno')).toBeOnTheScreen();
    expect(screen.getByLabelText('Fasce: Giornata intera')).toBeOnTheScreen();
    // A cashier works at the desk: contacts are shown.
    expect(screen.getByLabelText('Email: mario.rossi@example.it')).toBeOnTheScreen();
    expect(screen.getByLabelText('Telefono: +39 333 1234567')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Totale: 30,00\s€$/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Incassato: 10,00\s€$/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Saldo da incassare: 20,00\s€$/)).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/^Contanti, 10,00\s€, Riuscito, 20 ott, 12:05$/),
    ).toBeOnTheScreen();
    expect(screen.getByText('Nessuna nota.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Incasso registrato, 20 ott, 12:05, Anna')).toBeOnTheScreen();
    expect(screen.getByLabelText('Prenotazione creata, 20 ott, 12:00, Anna')).toBeOnTheScreen();
  });

  it.each(['beach_staff', 'viewer'] as const)(
    'hides the customer contacts from %s',
    async (role) => {
      const { screen } = await open('/bookings/b-1', { routes: dayRoutes({ role }) });
      expect(await screen.findByText('Rossi Mario')).toBeOnTheScreen();
      expect(screen.queryByText('mario.rossi@example.it')).toBeNull();
      expect(screen.queryByText('+39 333 1234567')).toBeNull();
      expect(screen.queryByText('Preferisce la prima fila')).toBeNull();
      expect(
        screen.getByText('I contatti del cliente sono visibili solo a cassa e direzione.'),
      ).toBeOnTheScreen();
    },
  );

  it('shows an anonymised customer as such', async () => {
    const routes = dayRoutes({
      details: {
        'b-1': bookingDetail({
          customer: customer({ anonymized_at: '2026-09-01T00:00:00Z', display_name: '' }),
        }),
      },
    });
    const { screen } = await open('/bookings/b-1', { routes });
    expect(await screen.findByText('Cliente anonimo')).toBeOnTheScreen();
    expect(screen.queryByText('mario.rossi@example.it')).toBeNull();
  });

  it('shows notes, refunds and a settled balance', async () => {
    const detail = bookingDetail({
      paid_amount: 3000,
      balance_due: 0,
      notes_internal: 'Ombrellone da sistemare',
      notes_customer: 'Arriviamo alle 11',
      payments: [
        ...bookingDetail().payments,
        {
          id: 'pay-2',
          provider: 'manual',
          method: 'card',
          direction: 'in',
          amount: 2500,
          status: 'succeeded',
          created_at: '2026-10-25T07:00:00Z',
        },
        {
          id: 'pay-3',
          provider: 'manual',
          method: 'cash',
          direction: 'refund',
          amount: 500,
          status: 'succeeded',
          created_at: '2026-10-25T07:10:00Z',
        },
      ],
    });
    const { screen } = await open('/bookings/b-1', {
      routes: dayRoutes({ details: { 'b-1': detail } }),
    });
    expect(await screen.findByLabelText('Note interne: Ombrellone da sistemare')).toBeOnTheScreen();
    expect(screen.getByLabelText('Note del cliente: Arriviamo alle 11')).toBeOnTheScreen();
    expect(screen.getByText('Saldato')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Rimborso · Contanti, -5,00\s€, Riuscito/)).toBeOnTheScreen();
  });

  it('tells the operations still waiting for the instance', async () => {
    const op = {
      id: 'op-1',
      idempotencyKey: 'key-1',
      createdAt: '2026-10-25T07:30:00.000Z',
      seq: 1,
      status: 'conflict',
      error: { status: 409, type: 'cash_session_closed' },
      scope: { instanceUrl: SESSION.instanceUrl, establishmentId: SESSION.establishmentId },
      kind: 'cash_payment',
      bookingId: 'b-1',
      amount: 500,
      label: 'A1 · AR-7K3Q9',
    } as OfflineOperation;
    const { screen, getPathname } = await open('/bookings/b-1', {
      offlineData: { [QUEUE_KEY]: JSON.stringify([op]) },
    });
    expect(
      await screen.findByText(/1 operazione su questa prenotazione non è ancora arrivata/),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Vedi le operazioni in attesa' }));
    await waitFor(() => expect(getPathname()).toBe('/pending'));
  });

  it('says when the booking no longer exists', async () => {
    const { screen } = await open('/bookings/missing');
    expect(await screen.findByText('La prenotazione non esiste più.')).toBeOnTheScreen();
  });

  it('shows the whole history on request', async () => {
    const history = Array.from({ length: 7 }, (_, i) => ({
      at: `2026-10-2${i}T08:00:00Z`,
      action: 'booking.modified',
      actor_type: 'user' as const,
    }));
    const { screen } = await open('/bookings/b-1', {
      routes: dayRoutes({ details: { 'b-1': bookingDetail({ history }) } }),
    });
    expect(await screen.findAllByText('Modificata')).toHaveLength(5);
    await fireEvent.press(screen.getByRole('button', { name: 'Mostra tutta la cronologia (7)' }));
    expect(screen.getAllByText('Modificata')).toHaveLength(7);
  });
});

describe('booking sheet of a stay split across spots (core 1.1)', () => {
  const line = bookingDetail().lines[0]!;
  const split = bookingDetail({
    starts_on: '2026-10-25',
    ends_on: '2026-10-30',
    lines: [
      {
        ...line,
        spot_id: 's-2',
        spot_label: 'A2',
        segments: [
          { spot_id: 's-2', spot_label: 'A2', starts_on: '2026-10-25', ends_on: '2026-10-27' },
          { spot_id: 's-9', spot_label: 'B4', starts_on: '2026-10-28', ends_on: '2026-10-30' },
        ],
      },
    ],
  });
  const day = (d: string) => formatDayLabel(d, 'it');

  it.each<WindowSize>(['phone', 'tablet'])('names every spot and its days (%s)', async (size) => {
    const { screen } = await open('/bookings/b-1', {
      size,
      routes: dayRoutes({ details: { 'b-1': split } }),
    });
    expect(await screen.findByText('A2 → B4')).toBeOnTheScreen();
    expect(
      screen.getByText(`A2: dal ${day('2026-10-25')} al ${day('2026-10-27')}`),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(`B4: dal ${day('2026-10-28')} al ${day('2026-10-30')}`),
    ).toBeOnTheScreen();
    // Read once, segment by segment, without the arrows.
    expect(
      screen.getByLabelText(
        new RegExp(
          `^A2: dal ${day('2026-10-25')} al ${day('2026-10-27')}, B4: dal ${day('2026-10-28')} al ${day('2026-10-30')}, `,
        ),
      ),
    ).toBeOnTheScreen();
  });

  it('shows no segment rows for a stay on one spot', async () => {
    const { screen } = await open('/bookings/b-1');
    expect(await screen.findByText('Postazione e periodo')).toBeOnTheScreen();
    expect(screen.queryByText(/: dal /)).toBeNull();
  });
});

describe('booking sheet: agreement, guests and summary for the customer (core 1.1)', () => {
  const agreement = { id: 'ag-1', name: 'Residenti', requirement: 'Residenza nel comune' };
  const verification = {
    id: 'v-1',
    subject: 'booking' as const,
    agreement_id: 'ag-1',
    requirement: 'Residenza nel comune',
    verified_at: '2026-10-25T07:30:00Z',
    verified_by_name: 'Anna',
  };
  const withAgreement = bookingDetail({
    agreement,
    partner: { id: 'pt-1', name: 'Hotel Mare', kind: 'struttura_ricettiva' },
    partner_share: { type: 'percent', percent: '50' },
    partner_amount: 1500,
    group_name: 'Famiglia Bianchi',
    group_origin: 'Milano',
    party_adults: 2,
    party_children: 1,
    guest_names: ['Luca Bianchi', 'Sara Bianchi'],
  });

  /** The booking before and after "Verificato"; the POST is recorded. */
  function verifyRoutes(role?: 'cashier' | 'beach_staff') {
    let verified = false;
    const posts: Request[] = [];
    const routes = {
      ...dayRoutes({ role }),
      [`GET ${EST}/bookings/b-1`]: () =>
        json(
          200,
          verified ? { ...withAgreement, requirement_verification: verification } : withAgreement,
        ),
      [`POST ${EST}/bookings/b-1/requirement-verification`]: (r: Request) => {
        posts.push(r);
        verified = true;
        // The core answers with the booking detail (contract: the verification).
        return json(200, { ...withAgreement, requirement_verification: verification });
      },
    };
    return { routes, posts };
  }

  it.each<WindowSize>(['phone', 'tablet'])(
    'shows guests and agreement and records the requirement check (%s)',
    async (size) => {
      const { routes, posts } = verifyRoutes();
      const { screen } = await open('/bookings/b-1', { size, routes });
      expect(await screen.findByText('Gruppo e ospiti')).toBeOnTheScreen();
      expect(screen.getByLabelText('Gruppo: Famiglia Bianchi')).toBeOnTheScreen();
      expect(screen.getByLabelText('Provenienza: Milano')).toBeOnTheScreen();
      expect(screen.getByLabelText('Persone: 2 adulti, 1 bambino')).toBeOnTheScreen();
      expect(screen.getByLabelText('Ospiti: Luca Bianchi, Sara Bianchi')).toBeOnTheScreen();
      expect(screen.getByLabelText('Convenzione: Residenti')).toBeOnTheScreen();
      expect(screen.getByLabelText('Partner: Hotel Mare')).toBeOnTheScreen();
      expect(
        screen.getByLabelText('Quota del partner: 50% a carico del partner'),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText(/^Importo a carico del partner: 15,00\s€$/)).toBeOnTheScreen();
      expect(screen.getByText('Requisito da verificare')).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: 'Verificato' }));
      expect(
        await screen.findByLabelText(/^Residenza nel comune, Verificato il .+ da Anna$/),
      ).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Verificato' })).toBeNull();
      expect(posts).toHaveLength(1);
      expect(posts[0]!.headers.get('If-Match')).toBe('"3"');
      expect(await posts[0]!.json()).toEqual({});
    },
  );

  it('shows the requirement to the beach staff without "Verificato" nor the summary', async () => {
    const { routes } = verifyRoutes('beach_staff');
    const { screen } = await open('/bookings/b-1', { routes });
    expect(await screen.findByText('Requisito da verificare')).toBeOnTheScreen();
    expect(screen.getByText('Residenza nel comune')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Verificato' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Invia riepilogo al cliente' })).toBeNull();
  });

  it('shows no agreement nor guests card for a plain booking', async () => {
    const { screen } = await open('/bookings/b-1');
    expect(await screen.findByText('Postazione e periodo')).toBeOnTheScreen();
    expect(screen.queryByText('Convenzione')).toBeNull();
    expect(screen.queryByText('Gruppo e ospiti')).toBeNull();
  });

  it.each<WindowSize>(['phone', 'tablet'])(
    'hands the summary to the share sheet (%s)',
    async (size) => {
      const share = jest.fn(() =>
        json(200, { text: 'Ciao Mario, la tua prenotazione AR-7K3Q9…', locale: 'it' }),
      );
      const { screen, dependencies } = await open('/bookings/b-1', {
        size,
        routes: { ...dayRoutes(), [`POST ${EST}/bookings/b-1/share-summary`]: share },
      });
      expect(
        await screen.findByText(
          'Ogni invio crea un nuovo link di gestione: quello inviato prima smette di funzionare.',
        ),
      ).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Invia riepilogo al cliente' }));
      await waitFor(() =>
        expect(dependencies.shareText).toHaveBeenCalledWith(
          'Ciao Mario, la tua prenotazione AR-7K3Q9…',
        ),
      );
      expect(share).toHaveBeenCalledTimes(1);
    },
  );

  it('says when the instance cannot prepare the summary', async () => {
    const { screen, dependencies } = await open('/bookings/b-1', {
      routes: {
        ...dayRoutes(),
        [`POST ${EST}/bookings/b-1/share-summary`]: () => problem(501, 'not_implemented'),
      },
    });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Invia riepilogo al cliente' }),
    );
    expect(
      await screen.findByText('Questa istanza non prepara ancora il riepilogo per il cliente.'),
    ).toBeOnTheScreen();
    expect(dependencies.shareText).not.toHaveBeenCalled();
  });

  it('disables the summary and the check offline', async () => {
    const { routes } = verifyRoutes();
    const { screen, connectivity } = await open('/bookings/b-1', { routes });
    expect(await screen.findByRole('button', { name: 'Verificato' })).toBeOnTheScreen();
    await act(async () => connectivity.set(false));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Verificato' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Invia riepilogo al cliente' })).toBeDisabled();
    expect(
      screen.getByText("Registrare la verifica richiede l'istanza raggiungibile."),
    ).toBeOnTheScreen();
    expect(screen.getByText("Queste azioni richiedono l'istanza raggiungibile.")).toBeOnTheScreen();
  });

  it('says when the booking changed before the check', async () => {
    const { screen } = await open('/bookings/b-1', {
      routes: {
        ...dayRoutes({ details: { 'b-1': withAgreement } }),
        [`POST ${EST}/bookings/b-1/requirement-verification`]: () =>
          problem(412, 'version_conflict'),
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Verificato' }));
    expect(
      await screen.findByText(
        'La prenotazione è cambiata nel frattempo: controlla la scheda aggiornata e riprova.',
      ),
    ).toBeOnTheScreen();
  });
});

describe('tablet: list and sheet side by side', () => {
  it('keeps the list beside the selected sheet', async () => {
    const { screen, getPathname } = await open('/bookings', { size: 'tablet' });
    expect(await screen.findByText('Seleziona una prenotazione')).toBeOnTheScreen();

    await fireEvent.press(await screen.findByTestId('booking-row-b-1'));
    expect(await screen.findByText('Postazione e periodo')).toBeOnTheScreen();
    expect(getPathname()).toBe('/bookings');
    expect(screen.getByTestId('booking-row-b-2')).toBeOnTheScreen();
    expect(screen.getByTestId('booking-row-b-1').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });

  it('opens a link to a booking in the split', async () => {
    const { screen, getPathname } = await open('/bookings/b-1', { size: 'tablet' });
    expect(await screen.findByText('Postazione e periodo')).toBeOnTheScreen();
    await waitFor(() => expect(getPathname()).toBe('/bookings'));
    expect(await screen.findByTestId('booking-row-b-2')).toBeOnTheScreen();
  });
});

describe('adaptive split of the bookings (tablet portrait and landscape)', () => {
  // The region is not an accessibility element, so it is found by its label.
  const detailRegion = (screen: Awaited<ReturnType<typeof open>>['screen']) =>
    screen.queryAllByLabelText('Prenotazione').find((e) => e.props.role === 'region') ?? null;

  it.each<WindowSize>(['tabletPortrait', 'tabletLandscape'])(
    'shows the list beside the detail region and keeps it on selection (%s)',
    async (size) => {
      const { screen, getPathname } = await open('/bookings', { size });
      expect(await screen.findByText('3 prenotazioni')).toBeOnTheScreen();
      const region = detailRegion(screen);
      expect(region).toBeOnTheScreen();
      expect(within(region!).getByText('Seleziona una prenotazione')).toBeOnTheScreen();

      await fireEvent.press(screen.getByTestId('booking-row-b-1'));
      expect(
        await within(detailRegion(screen)!).findByText('Postazione e periodo'),
      ).toBeOnTheScreen();
      expect(screen.queryByText('Seleziona una prenotazione')).toBeNull();
      expect(getPathname()).toBe('/bookings');
      expect(rowIds(screen)).toEqual(['b-1', 'b-2', 'b-3']);
    },
  );

  it.each<WindowSize>(['tabletPortrait', 'tabletLandscape'])(
    'has no detail region nor placeholder with an empty day (%s)',
    async (size) => {
      const { screen } = await open('/bookings', { size, routes: dayRoutes({ bookings: [] }) });
      expect(await screen.findByText('Nessuna prenotazione')).toBeOnTheScreen();
      await waitFor(() => expect(detailRegion(screen)).toBeNull());
      expect(screen.queryByText('Seleziona una prenotazione')).toBeNull();
    },
  );

  it('has no detail region when the instance refuses the list', async () => {
    const routes = dayRoutes();
    routes[`GET ${EST}/bookings`] = () => problem(403, 'forbidden');
    const { screen } = await open('/bookings', { routes, size: 'tabletPortrait' });
    expect(await screen.findByText('Non consentito per il tuo ruolo.')).toBeOnTheScreen();
    await waitFor(() => expect(detailRegion(screen)).toBeNull());
  });

  it('leaves the detail blank when the search matches nothing', async () => {
    const { screen } = await open('/bookings', { size: 'tabletPortrait' });
    await fireEvent.changeText(await screen.findByLabelText('Cerca prenotazioni'), 'zz9');
    expect(await screen.findByText('Nessun risultato')).toBeOnTheScreen();
    const region = detailRegion(screen);
    expect(region).toBeOnTheScreen();
    expect(within(region!).queryByText('Seleziona una prenotazione')).toBeNull();
    expect(region!.children).toHaveLength(0);
  });

  it.each<WindowSize>(['tabletPortrait', 'tabletLandscape'])(
    'redirects a booking link to the split (%s)',
    async (size) => {
      const { screen, getPathname } = await open('/bookings/b-1', { size });
      await waitFor(() => expect(getPathname()).toBe('/bookings'));
      expect(await screen.findByTestId('booking-row-b-2')).toBeOnTheScreen();
      expect(
        await within(detailRegion(screen)!).findByText('Postazione e periodo'),
      ).toBeOnTheScreen();
    },
  );
});

describe('search field of the bookings', () => {
  it.each<WindowSize>(['phone', 'tabletPortrait'])(
    'shows the clear button only with text and empties the search (%s)',
    async (size) => {
      const { screen } = await open('/bookings', { size });
      const search = await screen.findByLabelText('Cerca prenotazioni');
      expect(screen.queryByRole('button', { name: 'Cancella la ricerca' })).toBeNull();
      await fireEvent.changeText(search, 'nicolo');
      await waitFor(() => expect(rowIds(screen)).toEqual(['b-2']));
      await fireEvent.press(screen.getByRole('button', { name: 'Cancella la ricerca' }));
      await waitFor(() => expect(rowIds(screen)).toEqual(['b-1', 'b-2', 'b-3']));
      expect(screen.getByLabelText('Cerca prenotazioni')).toHaveDisplayValue('');
      expect(screen.queryByRole('button', { name: 'Cancella la ricerca' })).toBeNull();
    },
  );
});

describe('bookings in Split View (tablet without room for the sheet beside the list)', () => {
  const detailRegion = (screen: Awaited<ReturnType<typeof open>>['screen']) =>
    screen.queryAllByLabelText('Prenotazione').find((e) => e.props.role === 'region') ?? null;

  it('shows the list alone and pushes the sheet like on phones', async () => {
    const { screen, getPathname } = await open('/bookings', { size: 'tabletSplitView' });
    expect(await screen.findByText('3 prenotazioni')).toBeOnTheScreen();
    expect(detailRegion(screen)).toBeNull();
    expect(screen.queryByText('Seleziona una prenotazione')).toBeNull();

    await fireEvent.press(screen.getByTestId('booking-row-b-1'));
    await waitFor(() => expect(getPathname()).toBe('/bookings/b-1'));
    expect(await screen.findByText('Postazione e periodo')).toBeOnTheScreen();
    expect(detailRegion(screen)).toBeNull();
  });

  it('opens a booking link as the sheet, without redirecting to the list', async () => {
    const { screen, getPathname } = await open('/bookings/b-1', { size: 'tabletSplitView' });
    expect(await screen.findByText('Postazione e periodo')).toBeOnTheScreen();
    expect(getPathname()).toBe('/bookings/b-1');
    expect(screen.queryByTestId('booking-row-b-2')).toBeNull();
  });
});

describe('bookings across a resize (rotation, Split View)', () => {
  const detailRegion = (screen: Awaited<ReturnType<typeof open>>['screen']) =>
    screen.queryAllByLabelText('Prenotazione').find((e) => e.props.role === 'region') ?? null;

  it('moves the open sheet into the split when the window widens', async () => {
    const { screen, getPathname, getSearchParams } = await open('/bookings');
    await fireEvent.press(await screen.findByTestId('booking-row-b-1'));
    await waitFor(() => expect(getPathname()).toBe('/bookings/b-1'));
    expect(await screen.findByText('Postazione e periodo')).toBeOnTheScreen();

    await act(async () => setWindow('tabletPortrait'));

    await waitFor(() => expect(getPathname()).toBe('/bookings'));
    expect(getSearchParams()).toEqual(expect.objectContaining({ selected: 'b-1' }));
    expect(
      await within(detailRegion(screen)!).findByText('Postazione e periodo'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('booking-row-b-1').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );

    // Back leaves the bookings: no second list without the selection under it.
    await act(async () => router.back());
    await waitFor(() => expect(getPathname()).not.toBe('/bookings'));
    expect(getPathname()).toBe('/home');
  });

  it('pushes the selected sheet when the window narrows to a phone', async () => {
    const { screen, getPathname, getSearchParams } = await open('/bookings', {
      size: 'tabletPortrait',
    });
    await fireEvent.press(await screen.findByTestId('booking-row-b-1'));
    expect(
      await within(detailRegion(screen)!).findByText('Postazione e periodo'),
    ).toBeOnTheScreen();

    await act(async () => setWindow('phone'));

    await waitFor(() => expect(getPathname()).toBe('/bookings/b-1'));
    expect(await screen.findByText('Postazione e periodo')).toBeOnTheScreen();
    expect(detailRegion(screen)).toBeNull();

    // Back shows the list without a selection that would push the sheet again.
    await act(async () => router.back());
    await waitFor(() => expect(getPathname()).toBe('/bookings'));
    expect(await screen.findByTestId('booking-row-b-2')).toBeOnTheScreen();
    expect(getPathname()).toBe('/bookings');
    // The list cleared its selection before pushing the sheet (BookingsScreen effect).
    expect(getSearchParams().selected).toBeUndefined();
  });
});

describe('bookings of any day (ADR 0014)', () => {
  const BOOKINGS = `${EST}/bookings`;

  it.each<WindowSize>(['phone', 'tabletPortrait'])(
    'loads a day chosen in the calendar and shows its date in the third segment (%s)',
    async (size) => {
      const { screen, network } = await open('/bookings', { size });
      expect(await screen.findByText('3 prenotazioni')).toBeOnTheScreen();

      await pickDay(screen, '2026-11-03');

      await waitFor(() =>
        expect(datesRequested(network.calls, BOOKINGS, 'from')).toContain('2026-11-03'),
      );
      expect(await screen.findByText('Nessuna prenotazione')).toBeOnTheScreen();
      expect(screen.getByRole('radio', { name: 'mar 3 nov, cambia giorno' })).toBeChecked();
      expect(screen.getByRole('radio', { name: /^Oggi/ })).not.toBeChecked();
    },
  );

  it('goes back to "Oggi" when today\'s date is chosen in the calendar', async () => {
    const { screen } = await open('/bookings');
    expect(await screen.findByText('3 prenotazioni')).toBeOnTheScreen();
    await pickDay(screen, '2026-11-03');
    expect(await screen.findByText('Nessuna prenotazione')).toBeOnTheScreen();

    await pickDay(screen, '2026-10-25');

    expect(await screen.findByText('3 prenotazioni')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: /^Oggi/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Scegli un altro giorno' })).not.toBeChecked();
  });

  it('opens the day of a ?day=YYYY-MM-DD link', async () => {
    const { screen, network } = await open('/bookings?day=2026-11-03');
    expect(await screen.findByText('Nessuna prenotazione')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'mar 3 nov, cambia giorno' })).toBeChecked();
    // Today and tomorrow are also asked by the home (offline window); the list asks its day.
    expect(datesRequested(network.calls, BOOKINGS, 'from')).toContain('2026-11-03');
  });

  it('says a day outside today and tomorrow is online only', async () => {
    const routes = dayRoutes();
    const online = routes[`GET ${BOOKINGS}`]!;
    routes[`GET ${BOOKINGS}`] = (r) =>
      ['2026-10-25', '2026-10-26'].includes(new URL(r.url).searchParams.get('from') ?? '')
        ? online(r)
        : networkDown(r);
    const { screen, connectivity } = await open('/bookings', { routes });
    expect(await screen.findByText('3 prenotazioni')).toBeOnTheScreen();
    await act(async () => connectivity.set(false));

    await pickDay(screen, '2026-11-03');

    expect(await screen.findByText('Giorno disponibile solo online')).toBeOnTheScreen();
    expect(screen.getByText(/Sul dispositivo restano solo oggi e domani/)).toBeOnTheScreen();
    expect(rowIds(screen)).toEqual([]);
  });
});
