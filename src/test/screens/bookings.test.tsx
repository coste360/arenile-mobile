import { router } from 'expo-router';
import { act, fireEvent, waitFor } from 'expo-router/testing-library';

import { QUEUE_KEY } from '@/features/offline/queue';
import type { OfflineOperation } from '@/features/offline/types';
import { dayRoutes, EST } from '@/test/day-routes';
import { problem } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { bookingDetail, customer } from '@/test/operations-fixtures';
import { renderApp, type RenderAppOptions } from '@/test/render-app';

async function open(path: string, options: RenderAppOptions = {}) {
  const app = await renderApp({ session: SESSION, routes: dayRoutes(), ...options });
  expect(await app.screen.findByText('Lido Azzurro')).toBeOnTheScreen();
  await act(async () => router.push(path));
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
    await fireEvent.press(screen.getByRole('button', { name: 'Domani' }));
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
