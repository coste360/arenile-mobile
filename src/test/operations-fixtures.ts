// Fixtures of the operational day and the booking lists (phase 1 data).
import type {
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
