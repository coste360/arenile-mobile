import { router } from 'expo-router';
import { act, fireEvent, waitFor } from 'expo-router/testing-library';
import { ScrollView } from 'react-native';

import type { BookingDetail, OperationsDay, Role } from '@/api/types';
import { json, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { bookingDetail, operationalBooking, operationsDay, spot } from '@/test/operations-fixtures';
import { EST, PHASE2_DAY, phase2Instance, requestsTo, TICKET_LABEL } from '@/test/phase-2-routes';
import { renderApp, type WindowSize } from '@/test/render-app';

const nbsp = (s: string) => s.replace(/ /g, ' ');

const B2: BookingDetail = bookingDetail({
  id: 'b-2',
  code: 'AR-7K3Q9',
  version: 3,
  lines: [{ ...bookingDetail().lines[0]!, id: 'l-2', spot_id: 's-2', spot_label: 'A2' }],
});

const B3: BookingDetail = bookingDetail({
  id: 'b-3',
  code: 'AR-TKT37',
  version: 2,
  lines: [{ ...bookingDetail().lines[0]!, id: 'l-3', spot_id: 's-3', spot_label: 'A3' }],
});

function changeResult(overrides: Record<string, unknown> = {}) {
  return {
    applied: false,
    booking: B2,
    previous_total: 3000,
    new_total: 3000,
    price_difference: 0,
    conflicts: [],
    ...overrides,
  };
}

function moveRoutes(extra: Record<string, Handler> = {}): Record<string, Handler> {
  return {
    [`GET ${EST}/bookings/b-2`]: () => json(200, B2),
    [`GET ${EST}/bookings/b-3`]: () => json(200, B3),
    [`GET ${EST}/tickets/by-code/AR-TKT37`]: () =>
      json(200, {
        id: 't-37',
        kind: 'sale',
        booking_id: 'b-3',
        number_label: TICKET_LABEL,
        needs_assignment: false,
        version: 1,
      }),
    [`POST ${EST}/bookings/b-2/move`]: async (r) => {
      const body = (await r.clone().json()) as { dry_run?: boolean };
      return json(200, changeResult({ applied: !body.dry_run }));
    },
    ...extra,
  };
}

async function openSpot(
  label: string,
  { role = 'cashier', extra = {} }: { role?: Role; extra?: Record<string, Handler> } = {},
  size: WindowSize = 'phone',
) {
  const instance = phase2Instance({ role, extra: moveRoutes(extra) });
  const app = await renderApp({ session: SESSION, routes: instance.routes, size });
  await app.screen.findByText(/Anna · /);
  await act(async () => router.push('/map'));
  await fireEvent.press(await app.screen.findByRole('radio', { name: 'Elenco' }));
  await fireEvent.press(await app.screen.findByRole('button', { name: new RegExp(`^${label},`) }));
  return app;
}

async function openMove(
  label: string,
  options: Parameters<typeof openSpot>[1] = {},
  size: WindowSize = 'phone',
) {
  const app = await openSpot(label, options, size);
  await fireEvent.press(
    await app.screen.findByRole('button', { name: "Sposta su un'altra postazione" }),
  );
  return app;
}

describe('move a booking', () => {
  it.each<WindowSize>(['phone', 'tablet'])(
    'previews the move with a dry run, then moves with If-Match (%s)',
    async (size) => {
      const { screen, network } = await openMove('A2', {}, size);
      expect(await screen.findByText('Sposta AR-7K3Q9')).toBeOnTheScreen();
      // A1 is free, B1 is a released pass day; A2 (the current spot) and A3 are taken.
      expect(screen.getByRole('radio', { name: 'Postazione B1' })).toBeOnTheScreen();
      expect(screen.queryByRole('radio', { name: 'Postazione A2' })).toBeNull();
      expect(screen.queryByRole('radio', { name: 'Postazione A3' })).toBeNull();

      await fireEvent.press(screen.getByRole('radio', { name: 'Postazione A1' }));
      expect(await screen.findByText(nbsp('Il totale resta 30,00 €.'))).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Sposta su A1' }));
      expect(await screen.findByText('Spostare AR-7K3Q9 su A1?')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Sposta' }));
      expect(await screen.findByText('AR-7K3Q9 spostata su A1')).toBeOnTheScreen();

      const [preview, apply] = requestsTo(network.calls, 'POST', `${EST}/bookings/b-2/move`);
      expect(await preview!.json()).toEqual({ line_id: 'l-2', spot_id: 's-1', dry_run: true });
      expect(await apply!.json()).toEqual({ line_id: 'l-2', spot_id: 's-1' });
      expect(apply!.headers.get('If-Match')).toBe('"3"');
    },
  );

  it.each<WindowSize>(['phone', 'tablet'])(
    'opens the outcome at the top of the screen, not at the offset of the form (%s)',
    async (size) => {
      const { screen } = await openMove('A2', {}, size);
      await fireEvent.press(await screen.findByRole('radio', { name: 'Postazione A1' }));
      await screen.findByText(nbsp('Il totale resta 30,00 €.'));
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
      try {
        await fireEvent.press(screen.getByRole('button', { name: 'Sposta su A1' }));
        // The form and its confirmation keep the user's scroll offset.
        expect(scrollTo).not.toHaveBeenCalled();
        await fireEvent.press(screen.getByRole('button', { name: 'Sposta' }));
        await screen.findByTestId('move-done');
        expect(scrollTo).toHaveBeenCalledTimes(1);
        expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
      } finally {
        scrollTo.mockRestore();
      }
    },
  );

  it('shows the new price when the spot costs more', async () => {
    const { screen } = await openMove('A2', {
      extra: {
        [`POST ${EST}/bookings/b-2/move`]: () =>
          json(200, changeResult({ new_total: 3500, price_difference: 500 })),
      },
    });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Postazione A1' }));
    expect(await screen.findByText(nbsp('Nuovo totale 35,00 € (+5,00 €).'))).toBeOnTheScreen();
  });

  it('does not offer the move when another day of the stay is taken', async () => {
    const { screen } = await openMove('A2', {
      extra: {
        [`POST ${EST}/bookings/b-2/move`]: () =>
          json(
            200,
            changeResult({
              conflicts: [{ date: '2026-10-25', slot: 'PM', reason: 'spot_unavailable' }],
            }),
          ),
      },
    });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Postazione A1' }));
    expect(await screen.findByText('A1 non è libera per tutto il soggiorno:')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sposta su A1' })).toBeDisabled();
  });

  it('says so when the spot was taken in the meantime', async () => {
    const { screen } = await openMove('A2', {
      extra: {
        [`POST ${EST}/bookings/b-2/move`]: async (r) => {
          const body = (await r.clone().json()) as { dry_run?: boolean };
          return body.dry_run ? json(200, changeResult()) : problem(409, 'spot_unavailable');
        },
      },
    });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Postazione A1' }));
    await screen.findByText(nbsp('Il totale resta 30,00 €.'));
    await fireEvent.press(screen.getByRole('button', { name: 'Sposta su A1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sposta' }));
    expect(
      await screen.findByText("La postazione è stata appena occupata: scegline un'altra."),
    ).toBeOnTheScreen();
  });

  it('moves a daily sale through its ticket, without a price change', async () => {
    const { screen, network } = await openMove('A3', {
      extra: { [`POST ${EST}/tickets/t-37/move`]: () => json(200, {}) },
    });
    expect(
      await screen.findByText(
        `Vendita giornaliera ${TICKET_LABEL}: il totale del biglietto non cambia.`,
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Postazione A1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sposta su A1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sposta' }));
    expect(await screen.findByText('AR-TKT37 spostata su A1')).toBeOnTheScreen();
    const [move] = requestsTo(network.calls, 'POST', `${EST}/tickets/t-37/move`);
    expect(move!.headers.get('If-Match')).toBe('"1"');
    expect(await move!.json()).toEqual({ spot_id: 's-1' });
    expect(requestsTo(network.calls, 'POST', `${EST}/bookings/b-3/move`)).toHaveLength(0);
  });

  it.each<WindowSize>(['phone', 'tablet'])(
    'moves the spot of today for a split stay under way (%s)',
    async (size) => {
      // On A1 until yesterday, on A2 from today (core 1.1 segments); spot_id is the first one.
      const split: BookingDetail = {
        ...B2,
        status: 'checked_in',
        starts_on: '2026-10-22',
        ends_on: '2026-10-28',
        lines: [
          {
            ...B2.lines[0]!,
            spot_id: 's-1',
            spot_label: 'A1',
            segments: [
              { spot_id: 's-1', spot_label: 'A1', starts_on: '2026-10-22', ends_on: '2026-10-24' },
              { spot_id: 's-2', spot_label: 'A2', starts_on: '2026-10-25', ends_on: '2026-10-28' },
            ],
          },
        ],
      };
      const { screen, network } = await openMove(
        'A2',
        { extra: { [`GET ${EST}/bookings/b-2`]: () => json(200, split) } },
        size,
      );
      expect(await screen.findByText('Sposta AR-7K3Q9')).toBeOnTheScreen();
      expect(await screen.findByLabelText('Da: A2')).toBeOnTheScreen();
      // A2 is the spot of today: not a target; A1 (held only on past days) is free today.
      expect(screen.queryByRole('radio', { name: 'Postazione A2' })).toBeNull();
      await fireEvent.press(screen.getByRole('radio', { name: 'Postazione A1' }));
      await screen.findByText(nbsp('Il totale resta 30,00 €.'));
      await fireEvent.press(screen.getByRole('button', { name: 'Sposta su A1' }));
      expect(await screen.findByText('Spostare AR-7K3Q9 su A1?')).toBeOnTheScreen();
      expect(screen.getByText('La postazione A2 si libera e A1 viene occupata.')).toBeOnTheScreen();
      expect(requestsTo(network.calls, 'POST', `${EST}/bookings/b-2/move`)).toHaveLength(1);
    },
  );

  it('is offered in the booking sheet too', async () => {
    const instance = phase2Instance({ extra: moveRoutes() });
    const { screen } = await renderApp({ session: SESSION, routes: instance.routes });
    await screen.findByText(/Anna · /);
    await act(async () => router.push('/bookings/b-2'));
    await fireEvent.press(
      await screen.findByRole('button', { name: "Sposta su un'altra postazione" }),
    );
    expect(await screen.findByText('Sposta AR-7K3Q9')).toBeOnTheScreen();
  });

  it.each<Role>(['beach_staff', 'viewer'])('is hidden from %s', async (role) => {
    const { screen } = await openSpot('A2', { role });
    await screen.findByTestId('spot-sheet');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: "Sposta su un'altra postazione" })).toBeNull(),
    );
  });
});

/** Undo of a move or swap, open until 08:04 UTC (the test clock is 08:00 UTC). */
const UNDO = {
  move_id: 'm-1',
  kind: 'move',
  expires_at: '2026-10-25T08:04:00Z',
  booking_ids: ['b-2'],
};

/** A2 (b-2) under way from yesterday to the 28th, so it can move from today or tomorrow. */
const UNDER_WAY: BookingDetail = { ...B2, starts_on: '2026-10-24', ends_on: '2026-10-28' };

/** The phase 2 day plus A4, taken by another booking (AR-SWAP4, Verdi) to swap with. */
const SWAP_DAY: OperationsDay = operationsDay({
  spots: [
    ...PHASE2_DAY.spots,
    spot({
      spot_id: 's-5',
      label: 'A4',
      status: 'booked',
      booking: operationalBooking({
        booking_id: 'b-4',
        line_id: 'l-4',
        code: 'AR-SWAP4',
        occupant_label: 'Verdi',
        version: 7,
      }),
    }),
  ],
});

function swapResult(overrides: Record<string, unknown> = {}) {
  const side = (total: number) => ({
    booking: B2,
    from_spot_id: 's-2',
    to_spot_id: 's-5',
    previous_total: 3000,
    new_total: total,
    price_difference: total - 3000,
  });
  return {
    applied: false,
    from: '2026-10-25',
    to: '2026-10-25',
    a: side(3500),
    b: side(3000),
    conflicts: [],
    ...overrides,
  };
}

async function moveToA1(screen: Awaited<ReturnType<typeof openMove>>['screen']) {
  await fireEvent.press(await screen.findByRole('radio', { name: 'Postazione A1' }));
  await screen.findByText(nbsp('Il totale resta 30,00 €.'));
  await fireEvent.press(screen.getByRole('button', { name: 'Sposta su A1' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sposta' }));
  await screen.findByTestId('move-done');
}

describe('move from today or tomorrow', () => {
  it.each<WindowSize>(['phone', 'tablet'])(
    'moves from tomorrow, leaving today where it is (%s)',
    async (size) => {
      const { screen, network } = await openMove(
        'A2',
        {
          extra: {
            [`GET ${EST}/bookings/b-2`]: () => json(200, UNDER_WAY),
            [`GET ${EST}/operations/day`]: () => json(200, PHASE2_DAY),
          },
        },
        size,
      );
      expect(await screen.findByText('Da quando')).toBeOnTheScreen();
      await fireEvent.press(screen.getByText(/^Da domani/));
      expect(
        await screen.findByText(/^Lo spostamento vale da .*: oggi resta dov'è\.$/),
      ).toBeOnTheScreen();
      await moveToA1(screen);

      const [preview, apply] = requestsTo(network.calls, 'POST', `${EST}/bookings/b-2/move`);
      expect(await preview!.json()).toEqual({
        line_id: 'l-2',
        spot_id: 's-1',
        from: '2026-10-26',
        dry_run: true,
      });
      expect(await apply!.json()).toEqual({ line_id: 'l-2', spot_id: 's-1', from: '2026-10-26' });
      // The free spots offered are those of the first day moved.
      const days = network.calls
        .filter((r) => new URL(r.url).pathname === `${EST}/operations/day`)
        .map((r) => new URL(r.url).searchParams.get('date'));
      expect(days).toContain('2026-10-26');
    },
  );

  it('moves from today by default', async () => {
    const { screen, network } = await openMove('A2', {
      extra: { [`GET ${EST}/bookings/b-2`]: () => json(200, UNDER_WAY) },
    });
    expect(await screen.findByText('Da quando')).toBeOnTheScreen();
    await moveToA1(screen);
    const [, apply] = requestsTo(network.calls, 'POST', `${EST}/bookings/b-2/move`);
    expect(await apply!.json()).toEqual({ line_id: 'l-2', spot_id: 's-1', from: '2026-10-25' });
  });

  it('offers no start for a one-day stay', async () => {
    const { screen } = await openMove('A2');
    await screen.findByRole('radio', { name: 'Postazione A1' });
    expect(screen.queryByText('Da quando')).toBeNull();
  });
});

describe('undo a move', () => {
  it.each<WindowSize>(['phone', 'tablet'])(
    'undoes the move just made within 5 minutes (%s)',
    async (size) => {
      const { screen, network } = await openMove(
        'A2',
        {
          extra: {
            [`POST ${EST}/bookings/b-2/move`]: async (r) => {
              const body = (await r.clone().json()) as { dry_run?: boolean };
              return json(200, changeResult(body.dry_run ? {} : { applied: true, undo: UNDO }));
            },
            [`POST ${EST}/moves/m-1/undo`]: () => json(200, { undone: true, bookings: [B2] }),
          },
        },
        size,
      );
      await moveToA1(screen);
      expect(screen.getByText(/^Puoi annullarlo entro le /)).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Annulla spostamento' }));
      expect(
        await screen.findByText('Spostamento annullato: le postazioni sono tornate come prima.'),
      ).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Annulla spostamento' })).toBeNull();
      expect(requestsTo(network.calls, 'POST', `${EST}/moves/m-1/undo`)).toHaveLength(1);
    },
  );

  it('says when the 5 minutes are over', async () => {
    const { screen } = await openMove('A2', {
      extra: {
        [`POST ${EST}/bookings/b-2/move`]: async (r) => {
          const body = (await r.clone().json()) as { dry_run?: boolean };
          return json(200, changeResult(body.dry_run ? {} : { applied: true, undo: UNDO }));
        },
        [`POST ${EST}/moves/m-1/undo`]: () => problem(410, 'move_undo_expired'),
      },
    });
    await moveToA1(screen);
    await fireEvent.press(screen.getByRole('button', { name: 'Annulla spostamento' }));
    expect(
      await screen.findByText(
        'Sono passati più di 5 minuti: lo spostamento non si può più annullare.',
      ),
    ).toBeOnTheScreen();
  });

  it('offers no undo when the server gives none', async () => {
    const { screen } = await openMove('A2');
    await moveToA1(screen);
    expect(screen.queryByRole('button', { name: 'Annulla spostamento' })).toBeNull();
  });

  it('offers the last move of the booking when the move screen is opened again', async () => {
    const { screen, network } = await openMove('A2', {
      extra: {
        [`GET ${EST}/moves/last`]: () => json(200, { move: UNDO }),
        [`POST ${EST}/moves/m-1/undo`]: () => json(200, { undone: true, bookings: [B2] }),
      },
    });
    expect(await screen.findByText('Spostamento recente')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Annulla spostamento' }));
    expect(
      await screen.findByText('Spostamento annullato: le postazioni sono tornate come prima.'),
    ).toBeOnTheScreen();
    expect(requestsTo(network.calls, 'POST', `${EST}/moves/m-1/undo`)).toHaveLength(1);
  });

  it('does not offer the last move of another booking', async () => {
    const { screen } = await openMove('A2', {
      extra: {
        [`GET ${EST}/moves/last`]: () => json(200, { move: { ...UNDO, booking_ids: ['b-9'] } }),
      },
    });
    await screen.findByRole('radio', { name: 'Postazione A1' });
    expect(screen.queryByText('Spostamento recente')).toBeNull();
  });
});

describe('swap two bookings', () => {
  const swapRoutes = (handler: Handler = () => json(200, swapResult())) => ({
    [`GET ${EST}/operations/day`]: () => json(200, SWAP_DAY),
    [`POST ${EST}/bookings/swap`]: handler,
  });

  it.each<WindowSize>(['phone', 'tablet'])(
    'previews the swap, then swaps at the versions seen (%s)',
    async (size) => {
      const { screen, network } = await openMove(
        'A2',
        {
          extra: swapRoutes(async (r) => {
            const body = (await r.clone().json()) as { dry_run?: boolean };
            return json(
              200,
              swapResult(body.dry_run ? {} : { applied: true, undo: { ...UNDO, kind: 'swap' } }),
            );
          }),
        },
        size,
      );
      await fireEvent.press(await screen.findByText("Scambiare con un'altra prenotazione"));
      // Only other bookings: not A2 itself, not the daily ticket on A3, not free A1.
      expect(await screen.findByRole('radio', { name: 'Postazione A4, Verdi' })).toBeOnTheScreen();
      expect(screen.queryByRole('radio', { name: /^Postazione A3/ })).toBeNull();
      expect(screen.queryByRole('radio', { name: /^Postazione A1/ })).toBeNull();

      await fireEvent.press(screen.getByRole('radio', { name: 'Postazione A4, Verdi' }));
      expect(
        await screen.findByText(nbsp('AR-7K3Q9: Nuovo totale 35,00 € (+5,00 €).')),
      ).toBeOnTheScreen();
      expect(screen.getByText(nbsp('AR-SWAP4: Il totale resta 30,00 €.'))).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Scambia con A4' }));
      expect(await screen.findByText('Scambiare AR-7K3Q9 con AR-SWAP4?')).toBeOnTheScreen();
      expect(screen.getByText('AR-7K3Q9 passa su A4 e AR-SWAP4 su A2.')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Scambia' }));
      expect(await screen.findByText('AR-7K3Q9 e AR-SWAP4 scambiate')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Annulla spostamento' })).toBeOnTheScreen();

      const [preview, apply] = requestsTo(network.calls, 'POST', `${EST}/bookings/swap`);
      expect(await preview!.json()).toEqual({
        a: { booking_id: 'b-2', line_id: 'l-2', expected_version: 3 },
        b: { booking_id: 'b-4', line_id: 'l-4', expected_version: 7 },
        from: '2026-10-25',
        dry_run: true,
      });
      expect(await apply!.json()).toEqual({
        a: { booking_id: 'b-2', line_id: 'l-2', expected_version: 3 },
        b: { booking_id: 'b-4', line_id: 'l-4', expected_version: 7 },
        from: '2026-10-25',
      });
      expect(requestsTo(network.calls, 'POST', `${EST}/bookings/b-2/move`)).toHaveLength(0);
    },
  );

  it('says when the two bookings cannot be swapped', async () => {
    const { screen } = await openMove('A2', {
      extra: swapRoutes(() => problem(409, 'swap_conflict')),
    });
    await fireEvent.press(await screen.findByText("Scambiare con un'altra prenotazione"));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Postazione A4, Verdi' }));
    expect(
      await screen.findByText(
        'Queste due prenotazioni non si possono scambiare: non hanno giorni in comune da questa data o sono già sulla stessa postazione.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Scambia con A4' })).toBeDisabled();
  });

  it('is not offered for a daily ticket', async () => {
    const { screen } = await openMove('A3', {
      extra: { [`POST ${EST}/tickets/t-37/move`]: () => json(200, {}) },
    });
    await screen.findByText(
      `Vendita giornaliera ${TICKET_LABEL}: il totale del biglietto non cambia.`,
    );
    expect(screen.queryByText("Scambiare con un'altra prenotazione")).toBeNull();
  });
});

describe('undo what else the last move put elsewhere', () => {
  const other: BookingDetail = bookingDetail({ id: 'b-4', code: 'AR-SWAP4' });

  it('names the other booking of a swap and asks before putting both back', async () => {
    const { screen, network } = await openMove('A2', {
      extra: {
        [`GET ${EST}/moves/last`]: () =>
          json(200, { move: { ...UNDO, kind: 'swap', booking_ids: ['b-2', 'b-4'] } }),
        [`GET ${EST}/bookings/b-4`]: () => json(200, other),
        [`POST ${EST}/moves/m-1/undo`]: () => json(200, { undone: true, bookings: [B2, other] }),
      },
    });
    expect(
      await screen.findByText('Hai scambiato da poco questa prenotazione con AR-SWAP4.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Annulla spostamento' }));
    expect(await screen.findByText('Annullare lo spostamento?')).toBeOnTheScreen();
    expect(
      screen.getByText("Tornano dov'erano sia questa prenotazione sia AR-SWAP4."),
    ).toBeOnTheScreen();
    expect(requestsTo(network.calls, 'POST', `${EST}/moves/m-1/undo`)).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Ripristina le postazioni' }));
    expect(
      await screen.findByText('Spostamento annullato: le postazioni sono tornate come prima.'),
    ).toBeOnTheScreen();
    expect(requestsTo(network.calls, 'POST', `${EST}/moves/m-1/undo`)).toHaveLength(1);
  });

  it('counts the other bookings of a group move and does nothing when cancelled', async () => {
    const { screen, network } = await openMove('A2', {
      extra: {
        [`GET ${EST}/moves/last`]: () =>
          json(200, {
            move: { ...UNDO, kind: 'group', booking_ids: ['b-5', 'b-2', 'b-6', 'b-7'] },
          }),
        [`POST ${EST}/moves/m-1/undo`]: () => json(200, { undone: true, bookings: [] }),
      },
    });
    expect(
      await screen.findByText('Hai spostato da poco questa prenotazione e altre 3 prenotazioni.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Annulla spostamento' }));
    expect(
      await screen.findByText("Tornano dov'erano anche altre 3 prenotazioni."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByText('Annullare lo spostamento?')).toBeNull());
    expect(requestsTo(network.calls, 'POST', `${EST}/moves/m-1/undo`)).toHaveLength(0);
  });

  it('asks to try again when another change of the bookings is running', async () => {
    const { screen } = await openMove('A2', {
      extra: {
        [`GET ${EST}/moves/last`]: () => json(200, { move: UNDO }),
        [`POST ${EST}/moves/m-1/undo`]: () => problem(409, 'concurrent_update'),
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Annulla spostamento' }));
    expect(
      await screen.findByText(
        "Un'altra modifica di queste prenotazioni è in corso: riprova tra qualche secondo.",
      ),
    ).toBeOnTheScreen();
  });
});

describe('swap refusals and split stays', () => {
  it('reruns the preview with the new versions after a 412', async () => {
    let refreshed = false;
    const dayWith = (version: number): OperationsDay => ({
      ...SWAP_DAY,
      spots: SWAP_DAY.spots.map((s) =>
        s.spot_id === 's-5' && s.booking ? { ...s, booking: { ...s.booking, version } } : s,
      ),
    });
    const { screen, network } = await openMove('A2', {
      extra: {
        [`GET ${EST}/bookings/b-2`]: () => json(200, refreshed ? { ...B2, version: 4 } : B2),
        [`GET ${EST}/operations/day`]: () => json(200, dayWith(refreshed ? 8 : 7)),
        [`POST ${EST}/bookings/swap`]: async (r) => {
          const body = (await r.clone().json()) as { dry_run?: boolean };
          if (body.dry_run) return json(200, swapResult());
          refreshed = true;
          return problem(412, 'version_conflict');
        },
      },
    });
    await fireEvent.press(await screen.findByText("Scambiare con un'altra prenotazione"));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Postazione A4, Verdi' }));
    await screen.findByText(nbsp('AR-SWAP4: Il totale resta 30,00 €.'));
    await fireEvent.press(screen.getByRole('button', { name: 'Scambia con A4' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Scambia' }));
    expect(
      await screen.findByText(
        "Una delle due prenotazioni è cambiata nel frattempo: controlla l'anteprima aggiornata.",
      ),
    ).toBeOnTheScreen();
    // The day and the booking refresh one after the other: the last preview has both versions.
    await waitFor(async () => {
      const swaps = requestsTo(network.calls, 'POST', `${EST}/bookings/swap`);
      expect(await swaps[swaps.length - 1]!.clone().json()).toEqual({
        a: { booking_id: 'b-2', line_id: 'l-2', expected_version: 4 },
        b: { booking_id: 'b-4', line_id: 'l-4', expected_version: 8 },
        from: '2026-10-25',
        dry_run: true,
      });
    });
    // Only one swap was applied: the refusal.
    const applied = await Promise.all(
      requestsTo(network.calls, 'POST', `${EST}/bookings/swap`).map(
        async (r) => !((await r.clone().json()) as { dry_run?: boolean }).dry_run,
      ),
    );
    expect(applied.filter(Boolean)).toHaveLength(1);
  });

  it('lists the days the swap is not possible and keeps it disabled', async () => {
    const { screen } = await openMove('A2', {
      extra: {
        [`GET ${EST}/operations/day`]: () => json(200, SWAP_DAY),
        [`POST ${EST}/bookings/swap`]: () =>
          json(
            200,
            swapResult({
              conflicts: [{ date: '2026-10-25', slot: 'PM', reason: 'spot_unavailable' }],
            }),
          ),
      },
    });
    await fireEvent.press(await screen.findByText("Scambiare con un'altra prenotazione"));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Postazione A4, Verdi' }));
    expect(
      await screen.findByText('Lo scambio non è possibile in questi giorni:'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/, pomeriggio$/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Scambia con A4' })).toBeDisabled();
  });

  it('names every spot a split stay hands over in the swap confirmation', async () => {
    // On A2 until the 26th, then on B1: the other booking takes both.
    const split: BookingDetail = {
      ...UNDER_WAY,
      lines: [
        {
          ...B2.lines[0]!,
          segments: [
            { spot_id: 's-2', spot_label: 'A2', starts_on: '2026-10-24', ends_on: '2026-10-26' },
            { spot_id: 's-4', spot_label: 'B1', starts_on: '2026-10-27', ends_on: '2026-10-28' },
          ],
        },
      ],
    };
    const { screen } = await openMove('A2', {
      extra: {
        [`GET ${EST}/bookings/b-2`]: () => json(200, split),
        [`GET ${EST}/operations/day`]: () => json(200, SWAP_DAY),
        [`POST ${EST}/bookings/swap`]: () => json(200, swapResult()),
      },
    });
    await fireEvent.press(await screen.findByText("Scambiare con un'altra prenotazione"));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Postazione A4, Verdi' }));
    await screen.findByText(nbsp('AR-SWAP4: Il totale resta 30,00 €.'));
    await fireEvent.press(screen.getByRole('button', { name: 'Scambia con A4' }));
    expect(
      await screen.findByText('AR-7K3Q9 passa su A4 e AR-SWAP4 su A2 → B1.'),
    ).toBeOnTheScreen();
  });
});
