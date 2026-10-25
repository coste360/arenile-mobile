// TanStack Query keys of the establishment data, in one place. Conventions
// (docs/data-and-offline.md):
//
// - Establishment data lives under ['est', establishmentId, area, ...]: one
//   prefix invalidates an area, and the offline cache allowlists by area.
// - The last element of a list key is an object of its parameters
//   ({ date, slot }), so that partial matching works on the prefix.
// - Device, instance and session keys stay in features/session/queries.ts.
import type { CalendarDate } from '@/lib/calendar';

import type { ComparisonAlign, Slots } from './types';

/** Areas of the establishment data (second element after the id). */
export type EstablishmentArea =
  | 'operations'
  | 'bookings'
  | 'maps'
  | 'season-passes'
  | 'payments'
  | 'cash'
  | 'reports'
  | 'catalog'
  | 'tickets'
  | 'waitlist'
  | 'printing';

export const estKeys = {
  /** Every query of the establishment. */
  all: (establishmentId: string) => ['est', establishmentId] as const,
  area: (establishmentId: string, area: EstablishmentArea) =>
    ['est', establishmentId, area] as const,

  /** GET operations/day: status of every spot for a day and slot (map, Oggi). */
  operationsDay: (establishmentId: string, date: CalendarDate, slot: Slots = 'FULL') =>
    ['est', establishmentId, 'operations', 'day', { date, slot }] as const,

  /** GET bookings?from=date&to=date: every booking whose stay includes the day. */
  bookingsOfDay: (establishmentId: string, date: CalendarDate) =>
    ['est', establishmentId, 'bookings', 'day', { date }] as const,
  /** GET bookings/{id}: detail with lines, payments and history. */
  booking: (establishmentId: string, bookingId: string) =>
    ['est', establishmentId, 'bookings', 'detail', bookingId] as const,

  /** GET maps: the maps of the establishment, in display order. */
  maps: (establishmentId: string) => ['est', establishmentId, 'maps', 'list'] as const,
  /** GET maps/{id}: the full map document (spots and decorations). */
  map: (establishmentId: string, mapId: string) =>
    ['est', establishmentId, 'maps', 'detail', mapId] as const,

  /** GET cash-sessions/current: the open session of the main register (never persisted). */
  cashSession: (establishmentId: string) => ['est', establishmentId, 'cash', 'current'] as const,

  /** GET reports/comparison: a period against the previous year (phase 3, online only). */
  reportComparison: (
    establishmentId: string,
    params: { from: CalendarDate; to: CalendarDate; align: ComparisonAlign },
  ) => ['est', establishmentId, 'reports', 'comparison', params] as const,

  // Phase 2 (spec 03): online only, none of these keys is persisted.
  /** GET packs and extras: the sellable catalogue (daily sale). */
  packs: (establishmentId: string) => ['est', establishmentId, 'catalog', 'packs'] as const,
  extras: (establishmentId: string) => ['est', establishmentId, 'catalog', 'extras'] as const,
  /** GET daily-sale-settings: zone-first, automatic print, format. */
  dailySaleSettings: (establishmentId: string) =>
    ['est', establishmentId, 'tickets', 'settings'] as const,
  /** POST daily-sales/quote: price and availability of a sale (no write). */
  dailySaleQuote: (establishmentId: string, body: unknown) =>
    ['est', establishmentId, 'tickets', 'quote', body] as const,
  /** GET tickets/by-code/{code}: the ticket of a booking, if it has one. */
  ticketByCode: (establishmentId: string, code: string) =>
    ['est', establishmentId, 'tickets', 'by-code', code] as const,
  /** GET waitlist: entries in priority order, with their filters. */
  waitlist: (establishmentId: string, params: { status?: string; q?: string }) =>
    ['est', establishmentId, 'waitlist', 'list', params] as const,
  waitlistEntry: (establishmentId: string, entryId: string) =>
    ['est', establishmentId, 'waitlist', 'detail', entryId] as const,
  waitlistSettings: (establishmentId: string) =>
    ['est', establishmentId, 'waitlist', 'settings'] as const,
  /** GET print-routes/resolve: the ESC/POS printer of a document, if ready. */
  printRoute: (establishmentId: string, kind: string, registerId?: string) =>
    [
      'est',
      establishmentId,
      'printing',
      'route',
      { kind, registerId: registerId ?? null },
    ] as const,
  /** GET print-jobs/{id}: status of a print job. */
  printJob: (establishmentId: string, jobId: string) =>
    ['est', establishmentId, 'printing', 'job', jobId] as const,
};

export const authKeys = {
  /** GET auth/me with the device token: the pairing user, memberships, permissions. */
  me: (deviceId: string) => ['auth', 'me', deviceId] as const,
};
