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

type Customer = BookingDetail['customer'];

export function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'c-1',
    first_name: 'Mario',
    last_name: 'Rossi',
    display_name: 'Rossi Mario',
    email: 'mario.rossi@example.it',
    phone: '+39 333 1234567',
    locale: 'it',
    notes: 'Preferisce la prima fila',
    tags: ['abituale'],
    version: 1,
    created_at: '2026-06-01T09:00:00Z',
    updated_at: '2026-06-01T09:00:00Z',
    ...overrides,
  };
}

/** Booking detail matching bookingSummary(): one line on A1, a 10 € cash payment. */
export function bookingDetail(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return {
    id: 'b-1',
    code: 'AR-7K3Q9',
    status: 'confirmed',
    channel: 'desk',
    customer: customer(),
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
        pack_code: 'OMB-2L',
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
    payments: [
      {
        id: 'pay-1',
        provider: 'manual',
        method: 'cash',
        direction: 'in',
        amount: 1000,
        status: 'succeeded',
        created_at: '2026-10-20T10:05:00Z',
      },
    ],
    history: [
      {
        at: '2026-10-20T10:00:00Z',
        action: 'booking.created',
        actor_type: 'user',
        actor_name: 'Anna',
      },
      {
        at: '2026-10-20T10:05:00Z',
        action: 'payment.recorded',
        actor_type: 'user',
        actor_name: 'Anna',
      },
    ],
    price_snapshot: {
      engine_version: 1,
      currency: 'EUR',
      lines: [],
      discounts: [],
      rounding: 0,
      total: 3000,
      vat: [],
    },
    policy_snapshot: { rules: {} as BookingDetail['policy_snapshot']['rules'] },
    notes_customer: '',
    notes_internal: '',
    next_statuses: ['checked_in', 'cancelled', 'no_show'],
    version: 3,
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:05:00Z',
    ...overrides,
  };
}
