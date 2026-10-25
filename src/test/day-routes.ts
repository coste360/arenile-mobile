// Fake instance routes for the day screens (Oggi, bookings, spots): a
// paired device in Europe/Rome on 2026-10-25 (the fixed test clock).
import type { BookingDetail, BookingSummary, OperationsDay, Role } from '@/api/types';

import { DEVICE, json, meta, problem, type Handler } from './fake-fetch';
import { SESSION } from './fixtures';
import { bookingDetail, bookingSummary, operationsDay, spot } from './operations-fixtures';

export const EST = `/api/admin/v1/establishments/${SESSION.establishmentId}`;
export const TODAY = '2026-10-25';
export const TOMORROW = '2026-10-26';

/** A day with two arrivals, one present, one season pass and one cancelled booking. */
export const DAY_BOOKINGS: BookingSummary[] = [
  bookingSummary({
    id: 'b-1',
    code: 'AR-7K3Q9',
    customer_display_name: 'Rossi Mario',
    spot_labels: ['A1'],
    starts_on: TODAY,
    balance_due: 2000,
  }),
  bookingSummary({
    id: 'b-2',
    code: 'AR-2M8X1',
    customer_display_name: 'Bianchi Nicolò',
    spot_labels: ['A2'],
    starts_on: TODAY,
    ends_on: '2026-10-27',
    status: 'checked_in',
    channel: 'online',
    paid_amount: 3000,
    balance_due: 0,
  }),
  bookingSummary({
    id: 'b-3',
    code: 'AR-5P4Z7',
    customer_display_name: 'Verdi Anna',
    spot_labels: ['B4'],
    starts_on: '2026-06-01',
    ends_on: '2026-09-30',
    formula: 'season',
    is_season_pass: true,
    balance_due: 15000,
  }),
  bookingSummary({
    id: 'b-4',
    code: 'AR-9C1D2',
    customer_display_name: 'Neri Luca',
    spot_labels: ['C1'],
    starts_on: TODAY,
    status: 'cancelled',
  }),
];

export const DAY: OperationsDay = operationsDay({
  spots: [
    spot({ spot_id: 's-1', label: 'A1', status: 'booked' }),
    spot({ spot_id: 's-2', label: 'A2', status: 'checked_in' }),
    spot({ spot_id: 's-3', label: 'A10', status: 'free' }),
    spot({ spot_id: 's-4', label: 'B4', status: 'released', release_id: 'r-1' }),
  ],
  totals: {
    spots: 4,
    free: 2,
    occupied: 2,
    arrivals: 2,
    departures: 0,
    checked_in: 1,
    balance_due_amount: 17000,
    pending_assignments: 0,
  },
});

export interface DayRoutesOptions {
  role?: Role;
  bookings?: BookingSummary[];
  day?: OperationsDay;
  details?: Record<string, BookingDetail>;
}

export function dayRoutes({
  role = 'cashier',
  bookings = DAY_BOOKINGS,
  day = DAY,
  details = { 'b-1': bookingDetail() },
}: DayRoutesOptions = {}): Record<string, Handler> {
  const routes: Record<string, Handler> = {
    'GET /api/device/v1/self': () => json(200, { ...DEVICE, role }),
    'GET /api/admin/v1/meta': () => json(200, meta()),
    [`GET ${EST}`]: () =>
      json(200, {
        id: SESSION.establishmentId,
        name: 'Lido Azzurro',
        timezone: 'Europe/Rome',
        organization_id: 'org-1',
      }),
    [`GET ${EST}/operations/day`]: (req) =>
      new URL(req.url).searchParams.get('date') === TODAY
        ? json(200, day)
        : json(200, { ...day, date: TOMORROW, spots: [] }),
    [`GET ${EST}/bookings`]: (req) =>
      json(200, {
        items: new URL(req.url).searchParams.get('from') === TODAY ? bookings : [],
      }),
    [`GET ${EST}/maps`]: () => json(200, { items: [] }),
  };
  for (const [id, detail] of Object.entries(details)) {
    routes[`GET ${EST}/bookings/${id}`] = () => json(200, detail);
  }
  routes[`GET ${EST}/bookings/missing`] = () => problem(404, 'not_found');
  return routes;
}
