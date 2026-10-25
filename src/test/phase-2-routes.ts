// Fake instance for the phase 2 screens (spec 03): a paired device in
// Europe/Rome on 2026-10-25 (the fixed test clock) with the day map, the
// catalogue, the cash desk and the printing routes. Every route can be
// replaced through `extra`; `down()` makes the instance unreachable.
import type {
  MapDocument,
  OperationsDay,
  Pack,
  Extra,
  Permission,
  PrintRouteResolution,
  Role,
  WaitlistEntry,
} from '@/api/types';
import { ROLE_PERMISSIONS } from '@/features/permissions/permissions';

import { DEVICE, json, meta, networkDown, problem, type Handler } from './fake-fetch';
import { SESSION } from './fixtures';
import { mapDocument, mapSpot } from './map-fixtures';
import { operationalBooking, operationsDay, spot } from './operations-fixtures';

export const EST = `/api/admin/v1/establishments/${SESSION.establishmentId}`;
export const TODAY = '2026-10-25';
// Built in two parts: the style guard reads a quoted ticket number as a hex colour.
export const TICKET_LABEL = '#' + '037';

/** A1 free, A2 booked, A3 a daily ticket (#037), B1 a released pass day. */
export const PHASE2_DAY: OperationsDay = operationsDay({
  spots: [
    spot({ spot_id: 's-1', label: 'A1', status: 'free' }),
    spot({
      spot_id: 's-2',
      label: 'A2',
      status: 'booked',
      booking: operationalBooking({
        booking_id: 'b-2',
        line_id: 'l-2',
        code: 'AR-7K3Q9',
        customer_display_name: 'Niccolò Bianchi',
        occupant_label: 'Bianchi',
        version: 3,
      }),
    }),
    spot({
      spot_id: 's-3',
      label: 'A3',
      status: 'booked',
      booking: operationalBooking({
        booking_id: 'b-3',
        line_id: 'l-3',
        code: 'AR-TKT37',
        customer_display_name: '',
        occupant_label: TICKET_LABEL,
        balance_due: 0,
        paid_amount: 2500,
        total_amount: 2500,
        ticket: {
          id: 't-37',
          number: 37,
          label: TICKET_LABEL,
          needs_assignment: false,
          version: 1,
        },
      }),
    }),
    spot({ spot_id: 's-4', label: 'B1', zone_id: 'z-2', status: 'released', release_id: 'r-1' }),
  ],
});

export const PHASE2_MAP: MapDocument = mapDocument({
  spots: [
    mapSpot(),
    mapSpot({ id: 's-2', label: 'A2', number: 2, x: 160 }),
    mapSpot({ id: 's-3', label: 'A3', number: 3, x: 220 }),
    mapSpot({ id: 's-4', zone_id: 'z-2', label: 'B1', row_label: 'B', x: 100, y: 180 }),
  ],
});

export function pack(overrides: Partial<Pack> = {}): Pack {
  return {
    id: 'p-1',
    code: 'omb-2l',
    name: { it: 'Ombrellone e 2 lettini', en: 'Umbrella and 2 sunbeds' },
    description: { it: '' },
    composition: {},
    allowed_formulas: ['daily'],
    channels: ['desk', 'online'],
    max_per_booking: 1,
    requires_approval: false,
    sort_order: 1,
    active: true,
    version: 1,
    created_at: '2026-05-01T08:00:00Z',
    updated_at: '2026-05-01T08:00:00Z',
    ...overrides,
  } as Pack;
}

export function extra(overrides: Partial<Extra> = {}): Extra {
  return {
    id: 'x-1',
    code: 'lettino',
    name: { it: 'Lettino in più', en: 'Extra sunbed' },
    description: { it: '' },
    pricing_unit: 'per_day',
    max_quantity: 2,
    attach_to: 'booking',
    channels: ['desk'],
    sort_order: 1,
    active: true,
    version: 1,
    created_at: '2026-05-01T08:00:00Z',
    updated_at: '2026-05-01T08:00:00Z',
    ...overrides,
  } as Extra;
}

export const READY_ROUTE: PrintRouteResolution = {
  document_kind: 'daily_ticket',
  ready: true,
  copies: 1,
  kick_drawer: false,
  printer: { id: 'pr-1', name: 'Cassa 1' } as PrintRouteResolution['printer'],
};

export const OPEN_SESSION = {
  session: { id: 'cs-1', register_id: 'reg-1', status: 'open' },
};

export interface Phase2Setup {
  role?: Role;
  permissions?: Permission[];
  day?: OperationsDay;
  features?: string[];
  extra?: Record<string, Handler>;
}

export function phase2Instance({
  role = 'cashier',
  permissions,
  day = PHASE2_DAY,
  features = ['bookings', 'cash', 'season_passes'],
  extra: overrides = {},
}: Phase2Setup = {}) {
  let unreachable = false;
  const up =
    (h: Handler): Handler =>
    (r) =>
      unreachable ? networkDown(r) : h(r);
  const base: Record<string, Handler> = {
    'GET /api/device/v1/self': () => json(200, { ...DEVICE, role }),
    'GET /api/admin/v1/meta': () => json(200, meta({ features })),
    'GET /api/admin/v1/auth/me': () =>
      json(200, {
        principal_type: 'user',
        totp_enrolment_required: false,
        memberships: [
          {
            organization_id: 'org-1',
            establishment_id: SESSION.establishmentId,
            role,
            permissions: permissions ?? ROLE_PERMISSIONS[role],
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
    [`GET ${EST}/maps`]: () => json(200, { items: [PHASE2_MAP.map] }),
    [`GET ${EST}/maps/${PHASE2_MAP.map.id}`]: () => json(200, PHASE2_MAP),
    [`GET ${EST}/operations/day`]: (r) =>
      new URL(r.url).searchParams.get('date') === TODAY
        ? json(200, day)
        : json(200, operationsDay({ date: '2026-10-26', spots: [] })),
    [`GET ${EST}/bookings`]: () => json(200, { items: [] }),
    [`GET ${EST}/cash-sessions/current`]: () => json(200, OPEN_SESSION),
    [`GET ${EST}/print-routes/resolve`]: () => json(200, READY_ROUTE),
    [`GET ${EST}/tickets/by-code/AR-7K3Q9`]: () => problem(404, 'not_found'),
    ...overrides,
  };
  return {
    routes: Object.fromEntries(Object.entries(base).map(([k, h]) => [k, up(h)])),
    down: () => {
      unreachable = true;
    },
  };
}

/** Requests of `method path` received by the fake instance, in order. */
export function requestsTo(calls: Request[], method: string, path: string): Request[] {
  return calls.filter((r) => r.method === method && new URL(r.url).pathname === path);
}

export function waitlistEntry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    id: 'w-1',
    status: 'waiting',
    channel: 'desk',
    customer_id: 'c-9',
    customer_display_name: 'Esposito Gennaro',
    starts_on: '2026-10-25',
    ends_on: '2026-10-25',
    slots: 'FULL',
    pack_id: 'p-1',
    quantity: 1,
    priority: 0,
    position: 1,
    offer_count: 0,
    version: 1,
    created_at: '2026-10-20T09:00:00Z',
    updated_at: '2026-10-20T09:00:00Z',
    ...overrides,
  };
}
