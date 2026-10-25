// Fixtures of the operational day and the booking lists (phase 1 data).
import type {
  BookingDetail,
  BookingSummary,
  OperationalBooking,
  OperationalSpot,
  OperationsDay,
} from '@/api/types';

import { SESSION } from './fixtures';

export const EST_ID = SESSION.establishmentId;

export function operationalBooking(
  overrides: Partial<OperationalBooking> = {},
): OperationalBooking {
  return {
    booking_id: 'b-1',
    code: 'AR-7K3Q9',
    status: 'confirmed',
    channel: 'desk',
    customer_id: 'c-1',
    customer_display_name: 'Rossi Mario',
    occupant_label: 'Rossi',
    customer_anonymized: false,
    customer_tags: [],
    starts_on: '2026-10-25',
    ends_on: '2026-10-25',
    slots: 'FULL',
    is_season_pass: false,
    pack_codes: [],
    total_amount: 3000,
    paid_amount: 1000,
    balance_due: 2000,
    has_notes: false,
    has_extras: false,
    version: 3,
    ...overrides,
  };
}

export function spot(overrides: Partial<OperationalSpot> = {}): OperationalSpot {
  return {
    spot_id: 's-1',
    map_id: 'm-1',
    zone_id: 'z-1',
    label: 'A1',
    status: 'booked',
    ...overrides,
  };
}

export function operationsDay(overrides: Partial<OperationsDay> = {}): OperationsDay {
  return {
    date: '2026-10-25',
    slot: 'FULL',
    closed: false,
    spots: [spot({ booking: operationalBooking() })],
    pending_assignments: [],
    pools: [],
    totals: {
      spots: 1,
      free: 0,
      occupied: 1,
      arrivals: 1,
      departures: 0,
      checked_in: 0,
      balance_due_amount: 2000,
      pending_assignments: 0,
    },
    ...overrides,
  };
}

export function bookingSummary(overrides: Partial<BookingSummary> = {}): BookingSummary {
  return {
    id: 'b-1',
    code: 'AR-7K3Q9',
    status: 'confirmed',
    channel: 'desk',
    customer_id: 'c-1',
    customer_display_name: 'Rossi Mario',
    starts_on: '2026-10-25',
    ends_on: '2026-10-25',
    slots: 'FULL',
    formula: 'day',
    is_season_pass: false,
    total_amount: 3000,
    paid_amount: 1000,
    balance_due: 2000,
    deposit_due: 0,
    spot_labels: ['A1'],
    version: 3,
    created_at: '2026-10-20T10:00:00Z',
    ...overrides,
  };
}

/**
 * A booking detail (scheda prenotazione) matching bookingSummary(): the
 * nested snapshots are reduced to what the app reads.
 */
export function bookingDetail(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return {
    id: 'b-1',
    code: 'AR-7K3Q9',
    status: 'confirmed',
    channel: 'desk',
    customer: {
      id: 'c-1',
      first_name: 'Mario',
      last_name: 'Rossi',
      display_name: 'Rossi Mario',
      locale: 'it',
      notes: '',
      tags: [],
      version: 1,
      created_at: '2026-10-20T10:00:00Z',
      updated_at: '2026-10-20T10:00:00Z',
    },
    starts_on: '2026-10-25',
    ends_on: '2026-10-25',
    slots: 'FULL',
    formula: 'day',
    is_season_pass: false,
    total_amount: 3000,
    paid_amount: 1000,
    balance_due: 2000,
    deposit_due: 0,
    lines: [
      {
        id: 'l-1',
        pack_id: 'p-1',
        zone_id: 'z-1',
        spot_id: 's-1',
        spot_label: 'A1',
        assignment_status: 'assigned',
        quantity: 1,
        line_total: 3000,
        extras: [],
      },
    ],
    extras: [],
    allocations: [],
    payments: [],
    history: [],
    price_snapshot: {} as BookingDetail['price_snapshot'],
    policy_snapshot: { rules: [] } as unknown as BookingDetail['policy_snapshot'],
    notes_customer: '',
    notes_internal: '',
    next_statuses: ['checked_in', 'cancelled', 'no_show'],
    version: 3,
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    ...overrides,
  };
}
