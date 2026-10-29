// Core 1.1 on the day map (spec 30.4, 30.5): arrival and departure markers,
// quick filters, caption parts, the booking details of the spot sheet and
// the season calendar of a spot.
import { router } from 'expo-router';
import { act, fireEvent, waitFor, within } from 'expo-router/testing-library';

import type { OperationsDay, Role, SpotCalendar } from '@/api/types';
import { ROLE_PERMISSIONS } from '@/features/permissions/permissions';
import { DEVICE, json, meta, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { mapDocument, mapSpot } from '@/test/map-fixtures';
import { operationalBooking, operationsDay, spot } from '@/test/operations-fixtures';
import { renderApp, requestsOf, type WindowSize } from '@/test/render-app';

const EST = `/api/admin/v1/establishments/${SESSION.establishmentId}`;

/**
 * A1 free; A2 Bianchi arriving today, agreement with a hotel, setup and
 * party; A3 Verdi leaving today in the "Scout" group, present; B1 a pass
 * holder in the group.
 */
const DAY = operationsDay({
  spots: [
    spot({ spot_id: 's-1', label: 'A1', status: 'free' }),
    spot({
      spot_id: 's-2',
      label: 'A2',
      status: 'booked',
      booking: operationalBooking({
        booking_id: 'b-2',
        code: 'AR-ARR01',
        customer_display_name: 'Niccolò Bianchi',
        occupant_label: 'Bianchi',
        is_first_day: true,
        balance_due: 0,
        setup_label: '2L 1S',
        party_size: 4,
        agreement: {
          id: 'ag-1',
          name: 'Residenti',
          partner_id: 'p-1',
          partner_name: 'Comune di Gaeta',
        },
      }),
    }),
    spot({
      spot_id: 's-3',
      label: 'A3',
      status: 'checked_in',
      booking: operationalBooking({
        booking_id: 'b-3',
        code: 'AR-DEP01',
        customer_display_name: 'Anna Verdi',
        occupant_label: 'Verdi',
        is_last_day: true,
        group_name: 'Scout',
      }),
    }),
    spot({
      spot_id: 's-4',
      label: 'B1',
      status: 'pass_holder',
      booking: operationalBooking({
        booking_id: 'b-4',
        code: 'AR-PASS1',
        is_season_pass: true,
        customer_display_name: 'Luca Neri',
        occupant_label: 'Neri',
        balance_due: 0,
        group_name: 'Scout',
        partner: { id: 'p-2', name: 'Camping Pineta', kind: 'struttura_ricettiva' },
      }),
    }),
  ],
});

const DOCUMENT = mapDocument({
  spots: [
    mapSpot({ id: 's-1', label: 'A1', x: 100, y: 100 }),
    mapSpot({ id: 's-2', label: 'A2', x: 160, y: 100 }),
    mapSpot({ id: 's-3', label: 'A3', x: 220, y: 100 }),
    mapSpot({ id: 's-4', label: 'B1', x: 100, y: 200 }),
  ],
});

/** July 2026 from Wednesday 1 to Friday 3: A2 booked by AR-ARR01 with a balance on the 2nd. */
const CALENDAR: SpotCalendar = {
  spot_id: 's-2',
  label: 'A2',
  season_id: 'season-1',
  from: '2026-07-01',
  to: '2026-07-03',
  days: [
    { date: '2026-07-01', am: { status: 'free' }, pm: { status: 'free' } },
    {
      date: '2026-07-02',
      am: { status: 'booked', booking_id: 'b-2' },
      pm: { status: 'booked', booking_id: 'b-2' },
    },
    { date: '2026-07-03', am: { status: 'blocked' }, pm: { status: 'free' } },
  ],
  bookings: [
    {
      booking_id: 'b-2',
      code: 'AR-ARR01',
      status: 'confirmed',
      occupant_label: 'Bianchi',
      starts_on: '2026-07-02',
      ends_on: '2026-07-02',
      is_season_pass: false,
      balance_due: 1500,
    },
  ],
};

function routes(
  role: Role = 'cashier',
  day: OperationsDay = DAY,
  extra: Record<string, Handler> = {},
) {
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
            permissions: ROLE_PERMISSIONS[role],
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
    [`GET ${EST}/maps`]: () => json(200, { items: [DOCUMENT.map] }),
    [`GET ${EST}/maps/${DOCUMENT.map.id}`]: () => json(200, DOCUMENT),
    [`GET ${EST}/operations/day`]: () => json(200, day),
    [`GET ${EST}/bookings`]: () => json(200, { items: [] }),
    [`GET ${EST}/spots/s-2/calendar`]: () => json(200, CALENDAR),
    ...extra,
  };
}

async function openMap(
  size: WindowSize = 'phone',
  role: Role = 'cashier',
  extra: Record<string, Handler> = {},
) {
  const app = await renderApp({ session: SESSION, routes: routes(role, DAY, extra), size });
  await app.screen.findByText(/Anna · /);
  await act(async () => router.push('/map'));
  await app.screen.findByTestId('day-map-viewport');
  return app;
}

async function openSheet(screen: Awaited<ReturnType<typeof openMap>>['screen'], name: RegExp) {
  await fireEvent.press(await screen.findByRole('radio', { name: 'Elenco' }));
  await fireEvent.press(
    within(await screen.findByTestId('day-map-list')).getByRole('button', { name }),
  );
  return screen.findByTestId('spot-sheet');
}

describe('day map: arrivals, departures and quick filters (spec 30.4)', () => {
  it.each<WindowSize>(['phone', 'tabletPortrait'])(
    'counts arrivals and departures in the legend and names them in the list (%s)',
    async (size) => {
      const { screen } = await openMap(size);
      expect(await screen.findByLabelText('Arrivo: 1')).toBeOnTheScreen();
      expect(screen.getByLabelText('Partenza: 1')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('radio', { name: 'Elenco' }));
      const list = await screen.findByTestId('day-map-list');
      expect(
        within(list).getByRole('button', {
          name: 'A2, Prenotato in cassa, Niccolò Bianchi, Arrivo',
        }),
      ).toBeOnTheScreen();
      expect(
        within(list).getByRole('button', { name: 'A3, Presente, Anna Verdi, Partenza' }),
      ).toBeOnTheScreen();
    },
  );

  it.each<WindowSize>(['phone', 'tablet'])(
    'highlights one filter at a time and lists only its spots, pressed again to clear (%s)',
    async (size) => {
      const { screen } = await openMap(size);
      const bar = screen.getByTestId('map-filter-bar');
      expect(within(bar).getByRole('button', { name: 'Arrivi, 1' })).toBeOnTheScreen();
      expect(within(bar).getByRole('button', { name: 'Presenti, 1' })).toBeOnTheScreen();
      // The agreements (or partners) and the groups of the day, by name.
      expect(
        within(bar).getByRole('button', { name: 'Convenzione: Camping Pineta, 1' }),
      ).toBeOnTheScreen();
      expect(
        within(bar).getByRole('button', { name: 'Convenzione: Residenti, 1' }),
      ).toBeOnTheScreen();
      await fireEvent.press(within(bar).getByRole('button', { name: 'Gruppo: Scout, 2' }));
      expect(await screen.findByText('2 postazioni evidenziate')).toBeOnTheScreen();
      expect(within(bar).getByRole('button', { name: 'Gruppo: Scout, 2' })).toBeSelected();
      await fireEvent.press(screen.getByRole('radio', { name: 'Elenco' }));
      const labels = within(await screen.findByTestId('day-map-list'))
        .getAllByRole('button')
        .map((b) => (b.props.accessibilityLabel as string).split(',')[0]);
      expect(labels).toEqual(['A3', 'B1']);
      await fireEvent.press(within(bar).getByRole('button', { name: 'Gruppo: Scout, 2' }));
      await waitFor(() => expect(screen.queryByText('2 postazioni evidenziate')).toBeNull());
      expect(within(screen.getByTestId('day-map-list')).getAllByRole('button')).toHaveLength(4);
    },
  );

  it('searches within the filter', async () => {
    const { screen } = await openMap();
    const bar = screen.getByTestId('map-filter-bar');
    await fireEvent.press(within(bar).getByRole('button', { name: 'Arrivi, 1' }));
    await fireEvent.changeText(screen.getByLabelText('Cerca una postazione'), 'verdi');
    expect(
      await screen.findByText('Nessuna postazione corrisponde alla ricerca'),
    ).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Cerca una postazione'), 'bianchi');
    expect(await screen.findByText('1 postazione trovata')).toBeOnTheScreen();
  });

  it('says when no spot matches the filter', async () => {
    const quiet = operationsDay({ spots: [spot({ spot_id: 's-1', label: 'A1', status: 'free' })] });
    const app = await renderApp({
      session: SESSION,
      routes: routes('cashier', quiet),
      size: 'phone',
    });
    await app.screen.findByText(/Anna · /);
    await act(async () => router.push('/map'));
    const bar = await app.screen.findByTestId('map-filter-bar');
    await fireEvent.press(within(bar).getByRole('button', { name: 'Partenze, 0' }));
    expect(await app.screen.findByText('Nessuna postazione per questo filtro.')).toBeOnTheScreen();
  });

  it('toggles the caption parts, the customer on by default', async () => {
    const { screen } = await openMap();
    const bar = screen.getByTestId('map-filter-bar');
    const customer = within(bar).getByRole('button', {
      name: 'Etichetta sotto le postazioni: Cliente',
    });
    const end = within(bar).getByRole('button', {
      name: 'Etichetta sotto le postazioni: Fine soggiorno',
    });
    expect(customer).toBeSelected();
    expect(end).not.toBeSelected();
    await fireEvent.press(end);
    await fireEvent.press(customer);
    expect(
      within(screen.getByTestId('map-filter-bar')).getByRole('button', {
        name: 'Etichetta sotto le postazioni: Fine soggiorno',
      }),
    ).toBeSelected();
    expect(
      within(screen.getByTestId('map-filter-bar')).getByRole('button', {
        name: 'Etichetta sotto le postazioni: Cliente',
      }),
    ).not.toBeSelected();
  });
});

describe('day map: booking details in the spot sheet (core 1.1)', () => {
  it.each<WindowSize>(['phone', 'tabletLandscape'])(
    'shows setup, people, agreement with its partner and the arrival (%s)',
    async (size) => {
      const { screen } = await openMap(size);
      const sheet = await openSheet(screen, /^A2,/);
      expect(within(sheet).getByLabelText('Allestimento: 2L 1S')).toBeOnTheScreen();
      expect(within(sheet).getByLabelText('Persone: 4')).toBeOnTheScreen();
      expect(
        within(sheet).getByLabelText('Convenzione: Residenti · Comune di Gaeta'),
      ).toBeOnTheScreen();
      expect(within(sheet).getByText('Arrivo')).toBeOnTheScreen();
      expect(within(sheet).queryByText(/^Gruppo/)).toBeNull();
    },
  );

  it('shows the group and the partner of a booking without agreement', async () => {
    const { screen } = await openMap();
    const sheet = await openSheet(screen, /^B1,/);
    expect(within(sheet).getByLabelText('Gruppo: Scout')).toBeOnTheScreen();
    expect(within(sheet).getByLabelText('Partner: Camping Pineta')).toBeOnTheScreen();
  });
});

describe('spot calendar (spec 30.5)', () => {
  it.each<WindowSize>(['phone', 'tablet'])(
    'opens from the sheet: months by week, halves with status, bookings of the season (%s)',
    async (size) => {
      const { screen, network } = await openMap(size);
      const sheet = await openSheet(screen, /^A2,/);
      await fireEvent.press(
        within(sheet).getByRole('button', { name: 'Calendario della postazione' }),
      );
      expect(await screen.findByText('Calendario della postazione A2')).toBeOnTheScreen();
      expect(requestsOf(network.calls)).toContain(`GET ${EST}/spots/s-2/calendar`);
      const calendar = screen.getByTestId('spot-calendar');
      expect(within(calendar).getByText('luglio 2026')).toBeOnTheScreen();
      expect(within(calendar).getByTestId('day-2026-07-03')).toHaveProp(
        'accessibilityLabel',
        'ven 3 lug: Mattina Bloccato, Pomeriggio Libero',
      );
      // A balance due reads "da incassare", as on the map.
      const booked = within(calendar).getByRole('button', {
        name: 'gio 2 lug: Mattina Da incassare (AR-ARR01 Bianchi), Pomeriggio Da incassare (AR-ARR01 Bianchi)',
      });
      expect(booked).toBeOnTheScreen();
      expect(within(calendar).getByText('Da saldare 15,00 €')).toBeOnTheScreen();
      await fireEvent.press(booked);
      await waitFor(() => expect(requestsOf(network.calls)).toContain(`GET ${EST}/bookings/b-2`));
    },
  );

  it('is not offered offline', async () => {
    const { screen, connectivity } = await openMap();
    const sheet = await openSheet(screen, /^A2,/);
    await act(async () => connectivity.set(false));
    await waitFor(() =>
      expect(
        within(sheet).getByRole('button', { name: 'Calendario della postazione' }),
      ).toBeDisabled(),
    );
  });

  it('explains an instance without the calendar (501)', async () => {
    const { screen } = await openMap('phone', 'cashier', {
      [`GET ${EST}/spots/s-2/calendar`]: () => problem(501, 'not_implemented'),
    });
    const sheet = await openSheet(screen, /^A2,/);
    await fireEvent.press(
      within(sheet).getByRole('button', { name: 'Calendario della postazione' }),
    );
    expect(await screen.findByText(/non ha il calendario delle postazioni/)).toBeOnTheScreen();
  });
});
