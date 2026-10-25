import { fireEvent } from 'expo-router/testing-library';

import type { Role } from '@/api/types';
import { DEVICE, json, meta, networkDown, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { renderApp, type WindowSize } from '@/test/render-app';
import { yearComparison } from '@/test/reports-fixtures';

const EST = `/api/admin/v1/establishments/${SESSION.establishmentId}`;
const COMPARISON = `GET ${EST}/reports/comparison`;

// Intl separates currency and percent signs with no-break spaces.
const nbsp = (s: string) => s.replace(/ /g, ' ');

function routes(role: Role, comparison?: Handler): Record<string, Handler> {
  return {
    'GET /api/device/v1/self': () => json(200, { ...DEVICE, role }),
    'GET /api/admin/v1/meta': () => json(200, meta()),
    [`GET ${EST}`]: () =>
      json(200, {
        id: SESSION.establishmentId,
        name: 'Lido Azzurro',
        timezone: 'Europe/Rome',
        organization_id: 'org-1',
      }),
    [COMPARISON]:
      comparison ??
      ((req) => {
        const url = new URL(req.url);
        return json(
          200,
          yearComparison(url.searchParams.get('from')!, url.searchParams.get('to')!),
        );
      }),
  };
}

/** Query parameters of every comparison request, in order. */
function comparisonQueries(calls: Request[]) {
  return calls
    .filter((r) => new URL(r.url).pathname === `${EST}/reports/comparison`)
    .map((r) => Object.fromEntries(new URL(r.url).searchParams));
}

describe('reports entry point', () => {
  it.each<[Role, boolean]>([
    ['owner', true],
    ['manager', true],
    ['viewer', true],
    ['cashier', false],
    ['beach_staff', false],
  ])('the phone header offers the reports to a %s: %p', async (role, offered) => {
    const { screen } = await renderApp({ session: SESSION, routes: routes(role) });
    expect(await screen.findByText(/^Anna · /)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Report' }) !== null).toBe(offered);
  });

  it.each<[Role, boolean]>([
    ['manager', true],
    ['beach_staff', false],
  ])('the tablet pane lists the reports for a %s: %p', async (role, listed) => {
    const { screen } = await renderApp({ session: SESSION, routes: routes(role), size: 'tablet' });
    expect(await screen.findByText(/^Anna · /)).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: 'Report' }) !== null).toBe(listed);
  });

  it('opens the reports from the phone header', async () => {
    const { screen, getPathname } = await renderApp({
      session: SESSION,
      routes: routes('owner'),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Report' }));
    expect(getPathname()).toBe('/reports');
    expect(await screen.findByText('Incassato')).toBeOnTheScreen();
  });
});

describe('reports screen', () => {
  it.each<WindowSize>(['phone', 'tablet'])(
    "shows today's takings and occupancy against last year on a %s",
    async (size) => {
      const { screen, network } = await renderApp({
        session: SESSION,
        routes: routes('manager'),
        initialUrl: '/reports',
        size,
      });

      expect(await screen.findByText(nbsp('1250,00 €'))).toBeOnTheScreen();
      expect(screen.getByText('dom 25 ott')).toBeOnTheScreen();
      expect(screen.getByText('Oggi')).toBeOnTheScreen();
      expect(screen.getByText('Anno precedente: dal 25 ott 2025 al 25 ott 2025')).toBeOnTheScreen();
      // Each metric is one sentence for screen readers, direction in words.
      expect(
        screen.getByLabelText(
          nbsp('Incassato: 1250,00 €. Nel 2025: 1000,00 €. In aumento +25,0%.'),
        ),
      ).toBeOnTheScreen();
      expect(
        screen.getByLabelText('Occupazione: 62,3%. Nel 2025: 57,8%. In aumento +4,5 p.p..'),
      ).toBeOnTheScreen();
      expect(
        screen.getByLabelText('Prenotazioni: 40. Nel 2025: 50. In calo −20,0%.'),
      ).toBeOnTheScreen();
      expect(
        screen.getByLabelText(nbsp('Prenotato: 900,00 €. Nel 2025: 0,00 €. In aumento nuovo.')),
      ).toBeOnTheScreen();
      // Metrics the app does not show are ignored.
      expect(screen.queryByText(/Cancellazioni/)).toBeNull();
      expect(comparisonQueries(network.calls)).toEqual([
        {
          from: '2026-10-25',
          to: '2026-10-25',
          granularity: 'day',
          align: 'calendar',
          format: 'json',
        },
      ]);
      expect(
        screen.getByText('Le esportazioni dei report restano nel pannello web.'),
      ).toBeOnTheScreen();
    },
  );

  it('shows the week day by day, Monday to Sunday', async () => {
    const { screen, network } = await renderApp({
      session: SESSION,
      routes: routes('owner'),
      initialUrl: '/reports',
    });
    expect(await screen.findByText('Incassato')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Settimana' }));

    expect(await screen.findByText('Giorno per giorno')).toBeOnTheScreen();
    expect(screen.getByText('lun 19 ott – dom 25 ott')).toBeOnTheScreen();
    expect(screen.getByText('Questa settimana')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        nbsp(
          'lun 19 ott: incassato 500,00 €, nel 2025 400,00 €; occupazione 62,3%, nel 2025 50,0%.',
        ),
      ),
    ).toBeOnTheScreen();
    expect(comparisonQueries(network.calls).at(-1)).toMatchObject({
      from: '2026-10-19',
      to: '2026-10-25',
    });
  });

  it('goes back one day and never past today', async () => {
    const { screen, network } = await renderApp({
      session: SESSION,
      routes: routes('owner'),
      initialUrl: '/reports',
    });
    expect(await screen.findByText('Incassato')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Giorno successivo' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Giorno precedente' }));

    expect(await screen.findByText('sab 24 ott')).toBeOnTheScreen();
    expect(screen.queryByText('Oggi')).toBeNull();
    expect(screen.getByRole('button', { name: 'Giorno successivo' })).toBeEnabled();
    expect(comparisonQueries(network.calls).at(-1)).toMatchObject({
      from: '2026-10-24',
      to: '2026-10-24',
    });
  });

  it('compares with the same weekday of last year on request', async () => {
    const { screen, network } = await renderApp({
      session: SESSION,
      routes: routes('owner'),
      initialUrl: '/reports',
    });
    expect(await screen.findByText('Incassato')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Stesso giorno della settimana' }));

    expect(screen.getByRole('radio', { name: 'Stesso giorno della settimana' })).toBeChecked();
    await screen.findByText('Incassato');
    expect(comparisonQueries(network.calls).at(-1)).toMatchObject({ align: 'weekday' });
  });

  it('tells a role without reports that it is not allowed, without asking the instance', async () => {
    const { screen, network } = await renderApp({
      session: SESSION,
      routes: routes('cashier'),
      initialUrl: '/reports',
    });
    expect(await screen.findByText('Non consentito')).toBeOnTheScreen();
    expect(
      screen.getByText('I report sono riservati a titolare, gestore e sola lettura.'),
    ).toBeOnTheScreen();
    expect(comparisonQueries(network.calls)).toEqual([]);
  });

  it('shows "non consentito" when the instance refuses (403)', async () => {
    const { screen } = await renderApp({
      session: SESSION,
      routes: routes('viewer', () => problem(403, 'forbidden')),
      initialUrl: '/reports',
    });
    expect(await screen.findByText('Non consentito per il tuo ruolo.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Riprova' })).toBeNull();
  });

  it('explains that reports need the network, and retries', async () => {
    let down = true;
    const { screen } = await renderApp({
      session: SESSION,
      routes: routes('owner', (req) => {
        if (down) return networkDown(req);
        return json(200, yearComparison('2026-10-25', '2026-10-25'));
      }),
      initialUrl: '/reports',
    });
    // Network failures are retried twice (query client) before the message.
    expect(
      await screen.findByText('Report non disponibili senza rete', {}, { timeout: 8000 }),
    ).toBeOnTheScreen();

    down = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByText('Incassato')).toBeOnTheScreen();
  });

  it('says when the instance does not provide reports (501)', async () => {
    const { screen } = await renderApp({
      session: SESSION,
      routes: routes('owner', () => problem(501, 'not_implemented')),
      initialUrl: '/reports',
    });
    expect(await screen.findByText('Questa istanza non fornisce i report.')).toBeOnTheScreen();
  });
});
