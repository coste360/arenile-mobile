import { router } from 'expo-router';
import { act, fireEvent, waitFor } from 'expo-router/testing-library';
import { ScrollView } from 'react-native';

import type { BookingDetail, Role } from '@/api/types';
import { json, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { bookingDetail } from '@/test/operations-fixtures';
import { EST, phase2Instance, requestsTo, TICKET_LABEL } from '@/test/phase-2-routes';
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
