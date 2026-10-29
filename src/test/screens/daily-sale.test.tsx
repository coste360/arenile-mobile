import { router } from 'expo-router';
import { act, fireEvent, waitFor } from 'expo-router/testing-library';
import { ScrollView } from 'react-native';

import type { DailySaleQuoteRequest, Role } from '@/api/types';
import { json, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { EST, extra, pack, phase2Instance, requestsTo, TICKET_LABEL } from '@/test/phase-2-routes';
import { renderApp, type WindowSize } from '@/test/render-app';

const nbsp = (s: string) => s.replace(/ /g, ' ');

/** A 422 policy_violation of the core's booking rules, with its violations. */
const policyViolation = (...violations: { code: string; params?: Record<string, string> }[]) =>
  json(
    422,
    { type: 'policy_violation', title: 'policy_violation', status: 422, violations },
    'application/problem+json',
  );

const SAME_DAY_CLOSED = { code: 'same_day_closed', params: { reason: 'time' } };

const BREAKDOWN = {
  engine_version: 1,
  currency: 'EUR',
  lines: [],
  discounts: [],
  rounding: 0,
  total: 0,
  vat: [],
};

/** 25 € for the umbrella, 5 € for each extra sunbed. */
function quoteOf(body: DailySaleQuoteRequest) {
  const extras = (body.extras ?? []).reduce((n, x) => n + x.quantity, 0);
  const total = 2500 + extras * 500;
  return { breakdown: { ...BREAKDOWN, total }, total, available: true, conflicts: [] };
}

function saleResult(total: number, change?: number) {
  return {
    booking_id: 'b-38',
    payment_id: 'pay-38',
    ...(change !== undefined ? { change_amount: change } : {}),
    ticket: {
      id: 't-38',
      kind: 'sale',
      status: 'active',
      state: 'assigned',
      ticket_date: '2026-10-25',
      ticket_number: 38,
      number_label: TICKET_LABEL.replace('7', '8'),
      booking_id: 'b-38',
      booking_code: 'AR-TKT38',
      zone_id: 'z-1',
      zone_name: { it: 'Prima fila' },
      spot_id: 's-1',
      spot_label: 'A1',
      needs_assignment: false,
      slots: 'FULL',
      formula: 'daily',
      extras: [],
      entry_items: [],
      total_amount: total,
      vat: [],
      payment_method: change !== undefined ? 'cash' : 'card',
      print_count: 0,
      version: 1,
      created_at: '2026-10-25T08:00:00Z',
    },
  };
}

function saleRoutes(extraRoutes: Record<string, Handler> = {}): Record<string, Handler> {
  return {
    [`GET ${EST}/packs`]: () =>
      json(200, {
        items: [pack(), pack({ id: 'p-2', sort_order: 2, name: { it: 'Solo lettino' } })],
      }),
    [`GET ${EST}/extras`]: () => json(200, { items: [extra()] }),
    [`GET ${EST}/daily-sale-settings`]: () =>
      json(200, {
        print_format: 'thermal_80',
        auto_print: true,
        zone_first_enabled: true,
        footer_text: {},
        version: 1,
      }),
    [`POST ${EST}/daily-sales/quote`]: async (r) =>
      json(200, quoteOf((await r.json()) as DailySaleQuoteRequest)),
    [`POST ${EST}/print-jobs`]: () =>
      json(202, {
        id: 'job-38',
        document_kind: 'daily_ticket',
        status: 'printed',
        attempts: 1,
        max_attempts: 5,
        copies: 1,
        created_at: '2026-10-25T08:00:00Z',
        updated_at: '2026-10-25T08:00:00Z',
      }),
    [`GET ${EST}/print-jobs/job-38`]: () =>
      json(200, {
        id: 'job-38',
        document_kind: 'daily_ticket',
        status: 'printed',
        attempts: 1,
        max_attempts: 5,
        copies: 1,
        created_at: '2026-10-25T08:00:00Z',
        updated_at: '2026-10-25T08:00:00Z',
      }),
    ...extraRoutes,
  };
}

async function openSpotA1(
  {
    role = 'cashier',
    extra: extraRoutes = {},
    connected = true,
  }: { role?: Role; extra?: Record<string, Handler>; connected?: boolean } = {},
  size: WindowSize = 'phone',
) {
  const instance = phase2Instance({ role, extra: saleRoutes(extraRoutes) });
  const app = await renderApp({ session: SESSION, routes: instance.routes, size, connected });
  await app.screen.findByText(/Anna · /);
  await act(async () => router.push('/map'));
  await fireEvent.press(await app.screen.findByRole('radio', { name: 'Elenco' }));
  await fireEvent.press(await app.screen.findByRole('button', { name: /^A1,/ }));
  return { ...app, instance };
}

async function openSale(
  options: Parameters<typeof openSpotA1>[0] = {},
  size: WindowSize = 'phone',
) {
  const app = await openSpotA1(options, size);
  await fireEvent.press(await app.screen.findByRole('button', { name: 'Vendita giornaliera' }));
  await app.screen.findByText('Vendita giornaliera · A1');
  return app;
}

describe('daily quick sale', () => {
  it.each<WindowSize>(['phone', 'tablet'])(
    'sells a free spot in cash with an extra and the change, then prints the ticket (%s)',
    async (size) => {
      const { screen, network } = await openSale(
        {
          extra: {
            [`POST ${EST}/daily-sales`]: () => json(201, saleResult(3000, 2000)),
          },
        },
        size,
      );

      expect(await screen.findByLabelText(nbsp('Totale: 25,00 €'))).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Aggiungi un Lettino in più' }));
      expect(await screen.findByLabelText(nbsp('Totale: 30,00 €'))).toBeOnTheScreen();
      await fireEvent.changeText(screen.getByLabelText('Cognome'), 'Rossi');
      await fireEvent.changeText(screen.getByLabelText('Contanti ricevuti (facoltativo)'), '50');
      expect(await screen.findByText(nbsp('Resto da dare: 20,00 €'))).toBeOnTheScreen();

      await fireEvent.press(
        screen.getByRole('button', { name: nbsp('Incassa 30,00 € in contanti') }),
      );
      expect(await screen.findByText('Vendere A1?')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Conferma la vendita' }));

      expect(await screen.findByTestId('sale-done')).toBeOnTheScreen();
      expect(screen.getByText(nbsp('20,00 €'))).toBeOnTheScreen();

      const [sale] = requestsTo(network.calls, 'POST', `${EST}/daily-sales`);
      expect(sale!.headers.get('Idempotency-Key')).toBeTruthy();
      expect(await sale!.json()).toEqual({
        date: '2026-10-25',
        slots: 'FULL',
        pack_id: 'p-1',
        spot_id: 's-1',
        extras: [{ extra_id: 'x-1', quantity: 1 }],
        payment: { method: 'cash', tendered_amount: 5000 },
        holder: { last_name: 'Rossi' },
        expected_total: 3000,
      });
      // auto_print: the ticket goes to the printer of the register at once.
      await waitFor(() =>
        expect(requestsTo(network.calls, 'POST', `${EST}/print-jobs`)).toHaveLength(1),
      );
    },
  );

  it('offers only the card while the cash desk is closed', async () => {
    const { screen, network } = await openSale({
      extra: {
        [`GET ${EST}/cash-sessions/current`]: () => problem(404, 'not_found'),
        [`POST ${EST}/daily-sales`]: () => json(201, saleResult(2500)),
      },
    });
    expect(await screen.findByText(/La cassa è chiusa/)).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: 'Contanti' })).toBeNull();
    await fireEvent.press(
      await screen.findByRole('button', { name: nbsp('Incassa 25,00 € con carta') }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Conferma la vendita' }));
    await screen.findByTestId('sale-done');
    const [sale] = requestsTo(network.calls, 'POST', `${EST}/daily-sales`);
    expect((await sale!.json()).payment).toEqual({ method: 'card' });
  });

  it.each<WindowSize>(['phone', 'tablet'])(
    'opens the outcome at the top of the screen, not at the offset of the form (%s)',
    async (size) => {
      const { screen } = await openSale(
        { extra: { [`POST ${EST}/daily-sales`]: () => json(201, saleResult(2500, 0)) } },
        size,
      );
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
      try {
        await fireEvent.press(
          await screen.findByRole('button', { name: nbsp('Incassa 25,00 € in contanti') }),
        );
        // The form and its confirmation keep the user's scroll offset.
        expect(scrollTo).not.toHaveBeenCalled();
        await fireEvent.press(screen.getByRole('button', { name: 'Conferma la vendita' }));
        await screen.findByTestId('sale-done');
        expect(scrollTo).toHaveBeenCalledTimes(1);
        expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
      } finally {
        scrollTo.mockRestore();
      }
    },
  );

  it('says so when the spot was just taken, without leaving the form', async () => {
    const { screen } = await openSale({
      extra: { [`POST ${EST}/daily-sales`]: () => problem(409, 'spot_unavailable') },
    });
    await fireEvent.press(
      await screen.findByRole('button', { name: nbsp('Incassa 25,00 € in contanti') }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Conferma la vendita' }));
    expect(
      await screen.findByText(
        "La postazione è stata appena occupata: scegline un'altra dalla mappa.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('sale-done')).toBeNull();
  });

  it.each<WindowSize>(['phone', 'tablet'])(
    'lists the booking rules a refused sale broke, without leaving the form (%s)',
    async (size) => {
      const { screen } = await openSale(
        { extra: { [`POST ${EST}/daily-sales`]: () => policyViolation(SAME_DAY_CLOSED) } },
        size,
      );
      await fireEvent.press(
        await screen.findByRole('button', { name: nbsp('Incassa 25,00 € in contanti') }),
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Conferma la vendita' }));
      expect(
        await screen.findByText(
          'La vendita non rispetta le regole di prenotazione dello stabilimento.',
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText('Prenotazioni per oggi chiuse.')).toBeOnTheScreen();
      expect(screen.queryByTestId('sale-done')).toBeNull();
    },
  );

  it('reuses the Idempotency-Key when the same sale is retried after a failure', async () => {
    let attempts = 0;
    const { screen, network } = await openSale({
      extra: {
        [`POST ${EST}/daily-sales`]: () => {
          attempts += 1;
          return attempts === 1 ? problem(500, 'internal_error') : json(201, saleResult(2500, 0));
        },
      },
    });
    for (let i = 0; i < 2; i++) {
      await fireEvent.press(
        await screen.findByRole('button', { name: nbsp('Incassa 25,00 € in contanti') }),
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Conferma la vendita' }));
      if (i === 0) await screen.findByText('Vendita non riuscita. Riprova.');
    }
    await screen.findByTestId('sale-done');
    const keys = requestsTo(network.calls, 'POST', `${EST}/daily-sales`).map((r) =>
      r.headers.get('Idempotency-Key'),
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('takes a new Idempotency-Key after a refusal, so the retried sale is not refused again', async () => {
    let attempts = 0;
    const { screen, network } = await openSale({
      extra: {
        [`POST ${EST}/daily-sales`]: () => {
          attempts += 1;
          // The core stores the refusal and would replay it to the same key.
          return attempts === 1
            ? problem(409, 'cash_session_closed')
            : json(201, saleResult(2500, 0));
        },
      },
    });
    for (let i = 0; i < 2; i++) {
      await fireEvent.press(
        await screen.findByRole('button', { name: nbsp('Incassa 25,00 € in contanti') }),
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Conferma la vendita' }));
      if (i === 0) await waitFor(() => expect(attempts).toBe(1));
    }
    await screen.findByTestId('sale-done');
    const keys = requestsTo(network.calls, 'POST', `${EST}/daily-sales`).map((r) =>
      r.headers.get('Idempotency-Key'),
    );
    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('is disabled in the spot sheet while the instance is unreachable', async () => {
    const { screen, connectivity } = await openSpotA1();
    const button = await screen.findByRole('button', { name: 'Vendita giornaliera' });
    expect(button).toBeEnabled();
    await act(async () => connectivity.set(false));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Vendita giornaliera' })).toBeDisabled(),
    );
    expect(screen.getByText(/La vendita richiede l'istanza raggiungibile/)).toBeOnTheScreen();
  });

  it.each<Role>(['beach_staff', 'viewer'])(
    'is hidden from a role that cannot sell (%s), and refused on the route',
    async (role) => {
      const { screen } = await openSpotA1({ role });
      await screen.findByTestId('spot-sheet');
      expect(screen.queryByRole('button', { name: 'Vendita giornaliera' })).toBeNull();
      await act(async () =>
        router.push({ pathname: '/sale', params: { spotId: 's-1', date: '2026-10-25' } }),
      );
      expect(await screen.findByText('Non consentito per il tuo ruolo.')).toBeOnTheScreen();
    },
  );
});
