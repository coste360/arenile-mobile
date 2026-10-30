import { router } from 'expo-router';
import { act, fireEvent, waitFor } from 'expo-router/testing-library';

import type { BookingCreate, Role } from '@/api/types';
import { json, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { bookingDetail, operationsDay, spot } from '@/test/operations-fixtures';
import { EST, extra, pack, PHASE2_DAY, phase2Instance, requestsTo } from '@/test/phase-2-routes';
import { renderApp, type WindowSize } from '@/test/render-app';

const nbsp = (s: string) => s.replace(/ /g, ' ');

const BREAKDOWN = {
  engine_version: 1,
  currency: 'EUR',
  lines: [],
  discounts: [],
  rounding: 0,
  total: 0,
  vat: [],
};

const DAY_MS = 86_400_000;
const daysOf = (b: BookingCreate) =>
  Math.round((Date.parse(b.ends_on) - Date.parse(b.starts_on)) / DAY_MS) + 1;

/** 25 € a day, as many days as the stay; free, no rule broken. */
function quoteOf(body: BookingCreate, overrides: object = {}) {
  const total = 2500 * daysOf(body);
  return {
    breakdown: { ...BREAKDOWN, total },
    deposit_due: 0,
    policy: { rules: {}, violations: [] },
    available: true,
    conflicts: [],
    ...overrides,
  };
}

const HOLD = {
  id: 'h-1',
  channel: 'desk',
  status: 'active',
  starts_on: '2026-10-25',
  ends_on: '2026-10-25',
  slots: 'FULL',
  items: [{ spot_id: 's-1' }],
  // The test clock is 2026-10-25T08:00:00Z (09:00 in Rome).
  expires_at: '2026-10-25T08:15:00Z',
  created_at: '2026-10-25T08:00:00Z',
};

const CREATED = bookingDetail({
  id: 'b-new',
  code: 'AR-NEW01',
  starts_on: '2026-10-25',
  ends_on: '2026-10-31',
  formula: 'multi_day',
  total_amount: 17500,
  paid_amount: 0,
  balance_due: 17500,
  payments: [],
  customer: { ...bookingDetail().customer, display_name: 'Rossi' },
});

function bookingRoutes(extraRoutes: Record<string, Handler> = {}): Record<string, Handler> {
  return {
    [`GET ${EST}/packs`]: () =>
      json(200, {
        items: [
          pack({ allowed_formulas: ['day', 'half_day', 'multi_day'] }),
          pack({
            id: 'p-season',
            sort_order: 2,
            name: { it: 'Stagione' },
            allowed_formulas: ['season'],
          }),
        ],
      }),
    [`GET ${EST}/extras`]: () => json(200, { items: [extra()] }),
    [`POST ${EST}/bookings/quote`]: async (r) =>
      json(200, quoteOf((await r.json()) as BookingCreate)),
    [`POST ${EST}/holds`]: () => json(201, HOLD),
    [`DELETE ${EST}/holds/h-1`]: () => new Response(null, { status: 204 }),
    [`POST ${EST}/bookings`]: () => json(201, CREATED),
    [`GET ${EST}/bookings/b-new`]: () => json(200, CREATED),
    ...extraRoutes,
  };
}

async function openSpotA1(
  {
    role = 'cashier',
    extra: extraRoutes = {},
  }: { role?: Role; extra?: Record<string, Handler> } = {},
  size: WindowSize = 'phone',
) {
  const instance = phase2Instance({ role, extra: bookingRoutes(extraRoutes) });
  const app = await renderApp({ session: SESSION, routes: instance.routes, size });
  await app.screen.findByText(/Anna · /);
  await act(async () => router.push('/map'));
  await fireEvent.press(await app.screen.findByRole('radio', { name: 'Elenco' }));
  await fireEvent.press(await app.screen.findByRole('button', { name: /^A1,/ }));
  return { ...app, instance };
}

async function openNewBooking(
  options: Parameters<typeof openSpotA1>[0] = {},
  size: WindowSize = 'phone',
) {
  const app = await openSpotA1(options, size);
  await fireEvent.press(await app.screen.findByRole('button', { name: 'Nuova prenotazione' }));
  await app.screen.findByText('Prenota A1');
  return app;
}

type AppScreen = Awaited<ReturnType<typeof renderApp>>['screen'];

/** Presses an action once the quote of the current form is in (the quote is debounced). */
async function pressEnabled(screen: AppScreen, name: string) {
  await screen.findByRole('button', { name });
  await waitFor(() => expect(screen.getByRole('button', { name })).toBeEnabled());
  await fireEvent.press(screen.getByRole('button', { name }));
}

const totalOf = (amount: string) => nbsp(`Totale stimato ${amount}`);

describe('new booking on the fly', () => {
  it.each<WindowSize>(['phone', 'tablet'])(
    'books a free spot for a week with the estimated price, then opens the booking (%s)',
    async (size) => {
      const { screen, network } = await openNewBooking({}, size);

      expect(await screen.findByLabelText(totalOf('25,00 €'))).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: '7 giorni' }));
      expect(await screen.findByLabelText(totalOf('175,00 €'))).toBeOnTheScreen();
      // The season pack does not allow a stay of a week.
      expect(screen.queryByText('Stagione')).toBeNull();

      await fireEvent.changeText(screen.getByLabelText('Cognome'), 'Rossi');
      await fireEvent.changeText(screen.getByLabelText('Telefono'), '333 1234567');
      await pressEnabled(screen, nbsp('Prenota · 175,00 €'));
      expect(await screen.findByText('Prenotare A1?')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Prenota' }));

      expect(await screen.findByTestId('new-booking-done')).toBeOnTheScreen();
      expect(screen.getByText('Prenotazione AR-NEW01 creata')).toBeOnTheScreen();

      const [create] = requestsTo(network.calls, 'POST', `${EST}/bookings`);
      expect(create!.headers.get('Idempotency-Key')).toBeTruthy();
      expect(await create!.json()).toEqual({
        channel: 'desk',
        starts_on: '2026-10-25',
        ends_on: '2026-10-31',
        slots: 'FULL',
        formula: 'multi_day',
        lines: [{ pack_id: 'p-1', spot_id: 's-1', zone_id: 'z-1' }],
        status: 'confirmed',
        customer: { last_name: 'Rossi', phone: '+393331234567' },
      });
      expect(requestsTo(network.calls, 'POST', `${EST}/holds`)).toHaveLength(0);

      await fireEvent.press(screen.getByRole('button', { name: 'Apri la prenotazione' }));
      expect(await screen.findAllByText('AR-NEW01')).not.toHaveLength(0);
    },
  );

  it('asks for the surname before booking', async () => {
    const { screen, network } = await openNewBooking();
    await pressEnabled(screen, nbsp('Prenota · 25,00 €'));
    expect(await screen.findByText('Scrivi il cognome.')).toBeOnTheScreen();
    expect(screen.queryByText('Prenotare A1?')).toBeNull();
    expect(requestsTo(network.calls, 'POST', `${EST}/bookings`)).toHaveLength(0);
  });

  it.each<WindowSize>(['phone', 'tablet'])(
    'holds the spot, shows until when, and converts the hold into the booking (%s)',
    async (size) => {
      const { screen, network } = await openNewBooking({}, size);
      await pressEnabled(screen, 'Blocca per 15 minuti');
      expect(await screen.findByText('A1 bloccata fino alle 09:15')).toBeOnTheScreen();
      // The stay of a hold cannot change: the controls make way for the explanation.
      expect(screen.queryByRole('button', { name: '7 giorni' })).toBeNull();

      const [hold] = requestsTo(network.calls, 'POST', `${EST}/holds`);
      expect(hold!.headers.get('Idempotency-Key')).toBeTruthy();
      expect(await hold!.json()).toEqual({
        channel: 'desk',
        starts_on: '2026-10-25',
        ends_on: '2026-10-25',
        slots: 'FULL',
        items: [{ spot_id: 's-1' }],
        ttl_seconds: 900,
      });

      await fireEvent.changeText(screen.getByLabelText('Cognome'), 'Rossi');
      await pressEnabled(screen, nbsp('Prenota · 25,00 €'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Prenota' }));
      await screen.findByTestId('new-booking-done');
      const [create] = requestsTo(network.calls, 'POST', `${EST}/bookings`);
      expect((await create!.json()).hold_id).toBe('h-1');
      // The hold became the booking: nothing is released.
      expect(requestsTo(network.calls, 'DELETE', `${EST}/holds/h-1`)).toHaveLength(0);
    },
  );

  it('releases the hold on request and when the screen is left', async () => {
    const { screen, network } = await openNewBooking();
    await pressEnabled(screen, 'Blocca per 15 minuti');
    await fireEvent.press(await screen.findByRole('button', { name: 'Rilascia il blocco' }));
    await waitFor(() =>
      expect(requestsTo(network.calls, 'DELETE', `${EST}/holds/h-1`)).toHaveLength(1),
    );
    expect(await screen.findByRole('button', { name: '7 giorni' })).toBeOnTheScreen();

    await pressEnabled(screen, 'Blocca per 15 minuti');
    await screen.findByText('A1 bloccata fino alle 09:15');
    await act(async () => router.back());
    await waitFor(() =>
      expect(requestsTo(network.calls, 'DELETE', `${EST}/holds/h-1`)).toHaveLength(2),
    );
  });

  it('says when the hold has expired', async () => {
    const { screen } = await openNewBooking({
      extra: {
        [`POST ${EST}/holds`]: () => json(201, { ...HOLD, expires_at: '2026-10-25T07:59:00Z' }),
      },
    });
    await pressEnabled(screen, 'Blocca per 15 minuti');
    expect(
      await screen.findByText('Il blocco è scaduto: la postazione è di nuovo libera.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Blocca per 15 minuti' })).toBeOnTheScreen();
  });

  it('explains a hold expired before the booking and forgets it', async () => {
    const { screen } = await openNewBooking({
      extra: { [`POST ${EST}/bookings`]: () => problem(410, 'hold_expired') },
    });
    await pressEnabled(screen, 'Blocca per 15 minuti');
    await screen.findByText('A1 bloccata fino alle 09:15');
    await fireEvent.changeText(screen.getByLabelText('Cognome'), 'Rossi');
    await pressEnabled(screen, nbsp('Prenota · 25,00 €'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Prenota' }));
    expect(
      await screen.findByText(
        'Il blocco è scaduto prima della conferma: controlla che la postazione sia ancora libera.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText('A1 bloccata fino alle 09:15')).toBeNull();
    expect(screen.queryByTestId('new-booking-done')).toBeNull();
  });

  it.each<WindowSize>(['phone', 'tablet'])(
    'lists the booking rules the quote breaks and keeps the booking disabled (%s)',
    async (size) => {
      const { screen } = await openNewBooking(
        {
          extra: {
            [`POST ${EST}/bookings/quote`]: async (r) =>
              json(
                200,
                quoteOf((await r.json()) as BookingCreate, {
                  policy: { rules: {}, violations: [{ code: 'same_day_closed' }] },
                }),
              ),
          },
        },
        size,
      );
      expect(await screen.findByText('Prenotazioni per oggi chiuse.')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'La prenotazione non rispetta le regole di prenotazione dello stabilimento.',
        ),
      ).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: nbsp('Prenota · 25,00 €') })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Blocca per 15 minuti' })).toBeDisabled();
    },
  );

  it('names the days the spot is taken during the stay', async () => {
    const { screen } = await openNewBooking({
      extra: {
        [`POST ${EST}/bookings/quote`]: async (r) =>
          json(
            200,
            quoteOf((await r.json()) as BookingCreate, {
              available: false,
              conflicts: [
                { spot_id: 's-1', date: '2026-10-27', slot: 'AM', reason: 'spot_unavailable' },
              ],
            }),
          ),
      },
    });
    expect(await screen.findByText('A1 non è libera per tutto il soggiorno')).toBeOnTheScreen();
    expect(screen.getByText(/^mar 27 ott, /)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: nbsp('Prenota · 25,00 €') })).toBeDisabled();
  });

  it('explains a quote refused with 422 and its rules', async () => {
    const { screen } = await openNewBooking({
      extra: {
        [`POST ${EST}/bookings/quote`]: () =>
          json(
            422,
            {
              type: 'policy_violation',
              title: 'policy_violation',
              status: 422,
              violations: [{ code: 'lead_time_too_short' }],
            },
            'application/problem+json',
          ),
      },
    });
    expect(
      await screen.findByText(
        'La prenotazione non rispetta le regole di prenotazione dello stabilimento.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Prenota' })).toBeDisabled();
  });

  it('says so when the spot was just taken, without leaving the form', async () => {
    const { screen } = await openNewBooking({
      extra: { [`POST ${EST}/bookings`]: () => problem(409, 'spot_unavailable') },
    });
    await fireEvent.changeText(await screen.findByLabelText('Cognome'), 'Rossi');
    await pressEnabled(screen, nbsp('Prenota · 25,00 €'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Prenota' }));
    expect(await screen.findByText('Prenotazione non riuscita')).toBeOnTheScreen();
    expect(
      screen.getByText("La postazione non è più libera per queste date: scegline un'altra."),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('new-booking-done')).toBeNull();
  });

  it.each<WindowSize>(['phone', 'tablet'])(
    'starts from the bookings list and picks a free spot (%s)',
    async (size) => {
      const instance = phase2Instance({ extra: bookingRoutes() });
      const { screen } = await renderApp({ session: SESSION, routes: instance.routes, size });
      await screen.findByText(/Anna · /);
      await act(async () => router.push('/bookings'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Nuova prenotazione' }));

      expect(
        await screen.findByText('Scegli postazione, date e pacchetto per vedere il prezzo.'),
      ).toBeOnTheScreen();
      // A1 is free, B1 a released pass day; A2 and A3 are taken.
      expect(screen.getByRole('radio', { name: 'Postazione A1' })).toBeOnTheScreen();
      expect(screen.getByRole('radio', { name: 'Postazione B1' })).toBeOnTheScreen();
      expect(screen.queryByRole('radio', { name: 'Postazione A2' })).toBeNull();

      await fireEvent.press(screen.getByRole('radio', { name: 'Postazione A1' }));
      expect(await screen.findByText('Prenota A1')).toBeOnTheScreen();
      expect(await screen.findByLabelText(totalOf('25,00 €'))).toBeOnTheScreen();
    },
  );

  it('opens the form from a row of the free spots list', async () => {
    const instance = phase2Instance({ extra: bookingRoutes() });
    const { screen } = await renderApp({ session: SESSION, routes: instance.routes });
    await screen.findByText(/Anna · /);
    await act(async () => router.push({ pathname: '/spots', params: { status: 'free' } }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Prenota A1' }));
    expect(await screen.findByText('Prenota A1')).toBeOnTheScreen();
    expect(await screen.findByLabelText(totalOf('25,00 €'))).toBeOnTheScreen();
  });

  it('takes the last day from the calendar and keeps the length when the first day moves', async () => {
    const { screen } = await openNewBooking();
    await screen.findByLabelText(totalOf('25,00 €'));
    await fireEvent.press(screen.getByRole('button', { name: /^Al, / }));
    await fireEvent(
      await screen.findByTestId('new-booking-to-calendar'),
      'valueChange',
      { type: 'set' },
      new Date(2026, 9, 28, 12),
    );
    expect(await screen.findByLabelText(totalOf('100,00 €'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Dal, / }));
    await fireEvent(
      await screen.findByTestId('new-booking-from-calendar'),
      'valueChange',
      { type: 'set' },
      new Date(2026, 9, 27, 12),
    );
    // Four days from the 27th: the last day follows.
    expect(await screen.findByRole('button', { name: 'Al, ven 30 ott' })).toBeOnTheScreen();
    expect(await screen.findByLabelText(totalOf('100,00 €'))).toBeOnTheScreen();
  });

  it('is disabled without a connection to the instance', async () => {
    const { screen, connectivity } = await openSpotA1();
    await screen.findByRole('button', { name: 'Nuova prenotazione' });
    await act(async () => connectivity.set(false));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Nuova prenotazione' })).toBeDisabled(),
    );
  });

  it('quotes a held stay with its hold, so changing an extra keeps the booking possible', async () => {
    const quotes: BookingCreate[] = [];
    let heldOnServer = false;
    const { screen } = await openNewBooking({
      extra: {
        [`POST ${EST}/holds`]: () => {
          heldOnServer = true;
          return json(201, HOLD);
        },
        // Like the core: without hold_id the operator's own hold is a conflict.
        [`POST ${EST}/bookings/quote`]: async (r) => {
          const body = (await r.json()) as BookingCreate;
          quotes.push(body);
          const extras = (body.extras ?? []).reduce((n, x) => n + x.quantity, 0);
          return json(
            200,
            quoteOf(body, {
              breakdown: { ...BREAKDOWN, total: 2500 + extras * 500 },
              available: !heldOnServer || !!body.hold_id,
            }),
          );
        },
      },
    });
    await pressEnabled(screen, 'Blocca per 15 minuti');
    await screen.findByText('A1 bloccata fino alle 09:15');
    await fireEvent.press(screen.getByRole('button', { name: 'Aggiungi un Lettino in più' }));
    expect(await screen.findByLabelText(totalOf('30,00 €'))).toBeOnTheScreen();
    expect(quotes[quotes.length - 1]).toMatchObject({
      hold_id: 'h-1',
      extras: [{ extra_id: 'x-1', quantity: 1 }],
    });
    expect(screen.queryByText(/non è libera per tutto il soggiorno/)).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: nbsp('Prenota · 30,00 €') })).toBeEnabled(),
    );
  });

  it('asks for one quote after a burst of taps', async () => {
    const { screen, network } = await openNewBooking();
    await screen.findByLabelText(totalOf('25,00 €'));
    const before = requestsTo(network.calls, 'POST', `${EST}/bookings/quote`).length;
    await fireEvent.press(screen.getByRole('button', { name: 'Aggiungi un Lettino in più' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Aggiungi un Lettino in più' }));
    await fireEvent.press(screen.getByRole('button', { name: '7 giorni' }));
    // The screens run on Jest's fake timers: nothing was asked during the burst.
    expect(requestsTo(network.calls, 'POST', `${EST}/bookings/quote`)).toHaveLength(before);
    await waitFor(() =>
      expect(requestsTo(network.calls, 'POST', `${EST}/bookings/quote`)).toHaveLength(before + 1),
    );
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(requestsTo(network.calls, 'POST', `${EST}/bookings/quote`)).toHaveLength(before + 1);
  });

  it('keeps the hold when releasing it fails, and releases it when the screen is left', async () => {
    let deletes = 0;
    const { screen, network } = await openNewBooking({
      extra: {
        [`DELETE ${EST}/holds/h-1`]: () => {
          deletes += 1;
          return deletes === 1
            ? problem(500, 'internal_error')
            : new Response(null, { status: 204 });
        },
      },
    });
    await pressEnabled(screen, 'Blocca per 15 minuti');
    await fireEvent.press(await screen.findByRole('button', { name: 'Rilascia il blocco' }));
    expect(await screen.findByText('Prenotazione non riuscita')).toBeOnTheScreen();
    expect(screen.getByText('A1 bloccata fino alle 09:15')).toBeOnTheScreen();
    await act(async () => router.back());
    await waitFor(() =>
      expect(requestsTo(network.calls, 'DELETE', `${EST}/holds/h-1`)).toHaveLength(2),
    );
  });

  it('keeps the form while another first day loads, and retries a day that failed', async () => {
    let failing = true;
    const { screen } = await openNewBooking({
      extra: {
        [`GET ${EST}/operations/day`]: (r) => {
          const date = new URL(r.url).searchParams.get('date');
          if (date === '2026-10-25') return json(200, PHASE2_DAY);
          return failing
            ? problem(500, 'internal_error')
            : json(200, operationsDay({ date: date ?? '', spots: PHASE2_DAY.spots }));
        },
      },
    });
    await screen.findByLabelText(totalOf('25,00 €'));
    await fireEvent.press(screen.getByRole('button', { name: /^Dal, / }));
    await fireEvent(
      await screen.findByTestId('new-booking-from-calendar'),
      'valueChange',
      { type: 'set' },
      new Date(2026, 9, 27, 12),
    );
    expect(
      await screen.findByText('Impossibile leggere le postazioni di quel giorno.'),
    ).toBeOnTheScreen();
    // The rest of the form stays: no "no free spots" in place of the error.
    expect(screen.queryByText('Nessuna postazione libera con questa ricerca.')).toBeNull();
    expect(screen.getByLabelText('Cognome')).toBeOnTheScreen();

    failing = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('radio', { name: 'Postazione A1' })).toBeOnTheScreen();
    expect(await screen.findByText('Prenota A1')).toBeOnTheScreen();
  });

  it('books a half-day release for its free half from the released spots list', async () => {
    const quotes: BookingCreate[] = [];
    const instance = phase2Instance({
      day: operationsDay({
        spots: [
          ...PHASE2_DAY.spots,
          spot({
            spot_id: 's-5',
            label: 'C1',
            status: 'booked',
            am_status: 'released',
            pm_status: 'booked',
            release_id: 'r-5',
          }),
        ],
      }),
      extra: bookingRoutes({
        [`POST ${EST}/bookings/quote`]: async (r) => {
          const body = (await r.json()) as BookingCreate;
          quotes.push(body);
          return json(200, quoteOf(body));
        },
      }),
    });
    const { screen } = await renderApp({ session: SESSION, routes: instance.routes });
    await screen.findByText(/Anna · /);
    await act(async () => router.push({ pathname: '/spots', params: { status: 'released' } }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Prenota C1' }));
    expect(await screen.findByText('Prenota C1')).toBeOnTheScreen();
    await waitFor(() => expect(quotes.length).toBeGreaterThan(0));
    expect(quotes[quotes.length - 1]).toMatchObject({ slots: 'AM', formula: 'half_day' });
  });

  it.each<Role>(['beach_staff', 'viewer'])(
    'is hidden from a role that cannot write bookings (%s), and refused on the route',
    async (role) => {
      const { screen, network } = await openSpotA1({ role });
      await screen.findByTestId('spot-sheet');
      expect(screen.queryByRole('button', { name: 'Nuova prenotazione' })).toBeNull();
      await act(async () => router.push({ pathname: '/new-booking', params: { spotId: 's-1' } }));
      expect(await screen.findByText('Non consentito per il tuo ruolo.')).toBeOnTheScreen();
      expect(requestsTo(network.calls, 'POST', `${EST}/bookings/quote`)).toHaveLength(0);
    },
  );
});
