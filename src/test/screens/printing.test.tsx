import { router } from 'expo-router';
import { act, fireEvent, waitFor } from 'expo-router/testing-library';

import type { Role } from '@/api/types';
import { json, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { EST, phase2Instance, READY_ROUTE, requestsTo } from '@/test/phase-2-routes';
import { renderApp, type WindowSize } from '@/test/render-app';

const JOB = {
  id: 'job-1',
  document_kind: 'daily_ticket',
  document_id: 't-37',
  status: 'queued',
  attempts: 0,
  max_attempts: 5,
  copies: 1,
  created_at: '2026-10-25T08:00:00Z',
  updated_at: '2026-10-25T08:00:00Z',
};

async function openTicketSpot(
  { role = 'cashier', extra = {} }: { role?: Role; extra?: Record<string, Handler> } = {},
  size: WindowSize = 'phone',
) {
  const instance = phase2Instance({ role, extra });
  const app = await renderApp({ session: SESSION, routes: instance.routes, size });
  await app.screen.findByText(/Anna · /);
  await act(async () => router.push('/map'));
  await fireEvent.press(await app.screen.findByRole('radio', { name: 'Elenco' }));
  await fireEvent.press(await app.screen.findByRole('button', { name: /^A3,/ }));
  return { ...app, instance };
}

describe('ticket printing', () => {
  it.each<WindowSize>(['phone', 'tablet'])(
    'asks the instance to print the ticket of a spot and follows the job (%s)',
    async (size) => {
      let polls = 0;
      const { screen, network } = await openTicketSpot(
        {
          extra: {
            [`POST ${EST}/print-jobs`]: () => json(202, JOB),
            [`GET ${EST}/print-jobs/job-1`]: () => {
              polls += 1;
              return json(200, { ...JOB, status: polls > 1 ? 'printed' : 'printing' });
            },
          },
        },
        size,
      );

      const button = await screen.findByRole('button', {
        name: 'Stampa il biglietto #037 su Cassa 1',
      });
      await fireEvent.press(button);
      expect(await screen.findByText('Invio a Cassa 1…')).toBeOnTheScreen();
      expect(
        await screen.findByText('Biglietto #037 stampato.', {}, { timeout: 5000 }),
      ).toBeOnTheScreen();

      const [post] = requestsTo(network.calls, 'POST', `${EST}/print-jobs`);
      expect(post!.headers.get('Idempotency-Key')).toBeTruthy();
      expect(await post!.json()).toEqual({
        document_kind: 'daily_ticket',
        document_id: 't-37',
        register_id: 'reg-1',
      });
      const [resolve] = requestsTo(network.calls, 'GET', `${EST}/print-routes/resolve`);
      expect(new URL(resolve!.url).searchParams.get('register_id')).toBe('reg-1');
      expect(new URL(resolve!.url).searchParams.get('document_kind')).toBe('daily_ticket');
    },
  );

  it('offers to retry a job the printer did not print', async () => {
    const { screen, network } = await openTicketSpot({
      extra: {
        [`POST ${EST}/print-jobs`]: () => json(202, { ...JOB, status: 'failed' }),
        [`GET ${EST}/print-jobs/job-1`]: () => json(200, { ...JOB, status: 'failed' }),
        [`POST ${EST}/print-jobs/job-1/retry`]: () => json(202, { ...JOB, status: 'printed' }),
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: /Stampa il biglietto #037/ }));
    expect(await screen.findByText('Cassa 1 non ha stampato il biglietto.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Riprova la stampa' }));
    expect(await screen.findByText('Biglietto #037 stampato.')).toBeOnTheScreen();
    expect(requestsTo(network.calls, 'POST', `${EST}/print-jobs/job-1/retry`)).toHaveLength(1);
  });

  it('says why when no printer is ready (server edition)', async () => {
    const { screen, network } = await openTicketSpot({
      extra: {
        [`GET ${EST}/print-routes/resolve`]: () =>
          json(200, { ...READY_ROUTE, ready: false, reason: 'server_edition', printer: undefined }),
      },
    });
    expect(await screen.findByTestId('ticket-print-unready')).toHaveTextContent(
      /edizione desktop di Arenile/,
    );
    expect(screen.queryByRole('button', { name: /Stampa il biglietto/ })).toBeNull();
    expect(requestsTo(network.calls, 'POST', `${EST}/print-jobs`)).toHaveLength(0);
  });

  it('prints once: a retry after a lost answer reuses the Idempotency-Key, a reprint does not', async () => {
    let attempts = 0;
    const { screen, network } = await openTicketSpot({
      extra: {
        [`POST ${EST}/print-jobs`]: () => {
          attempts += 1;
          return attempts === 1 ? problem(503, 'internal_error') : json(202, JOB);
        },
        [`GET ${EST}/print-jobs/job-1`]: () => json(200, { ...JOB, status: 'printed' }),
      },
    });
    const print = async () =>
      fireEvent.press(await screen.findByRole('button', { name: /Stampa il biglietto #037/ }));
    await print();
    await waitFor(() => expect(attempts).toBe(1));
    await print();
    expect(await screen.findByText('Biglietto #037 stampato.')).toBeOnTheScreen();
    await print();
    await waitFor(() => expect(attempts).toBe(3));
    const keys = requestsTo(network.calls, 'POST', `${EST}/print-jobs`).map((r) =>
      r.headers.get('Idempotency-Key'),
    );
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it('shows the server refusal', async () => {
    const { screen } = await openTicketSpot({
      extra: { [`POST ${EST}/print-jobs`]: () => problem(409, 'printing_unavailable') },
    });
    await fireEvent.press(await screen.findByRole('button', { name: /Stampa il biglietto #037/ }));
    expect(
      await screen.findByText('Questa istanza non stampa sulle stampanti del lido.'),
    ).toBeOnTheScreen();
  });

  it.each<Role>(['beach_staff', 'viewer'])(
    'is hidden from a role without cash.operate (%s)',
    async (role) => {
      const { screen, network } = await openTicketSpot({ role });
      await screen.findByTestId('spot-sheet');
      expect(screen.queryByTestId('ticket-print')).toBeNull();
      await waitFor(() =>
        expect(requestsTo(network.calls, 'GET', `${EST}/print-routes/resolve`)).toHaveLength(0),
      );
    },
  );
});
