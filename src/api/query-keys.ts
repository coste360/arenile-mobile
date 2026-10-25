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
  'operations' | 'bookings' | 'maps' | 'season-passes' | 'payments' | 'reports';

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

  /** GET reports/comparison: a period against the previous year (phase 3, online only). */
  reportComparison: (
    establishmentId: string,
    params: { from: CalendarDate; to: CalendarDate; align: ComparisonAlign },
  ) => ['est', establishmentId, 'reports', 'comparison', params] as const,
};

export const authKeys = {
  /** GET auth/me with the device token: the pairing user, memberships, permissions. */
  me: (deviceId: string) => ['auth', 'me', deviceId] as const,
};
