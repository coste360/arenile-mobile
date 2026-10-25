import type { OfflineOperation } from '@/features/offline/types';
import { abilitiesFrom, ROLE_PERMISSIONS } from '@/features/permissions/permissions';
import type { Role } from '@/api/types';
import { bookingDetail, customer } from '@/test/operations-fixtures';

import {
  canSeeCustomerContacts,
  customerView,
  historyViews,
  paymentViews,
  queuedFor,
  spotLines,
  stayDays,
} from './detail';

describe('canSeeCustomerContacts', () => {
  it.each<[Role, boolean]>([
    ['owner', true],
    ['manager', true],
    ['cashier', true],
    ['beach_staff', false],
    ['viewer', false],
  ])('%s: %s', (role, expected) => {
    expect(canSeeCustomerContacts(abilitiesFrom(new Set(ROLE_PERMISSIONS[role]), true))).toBe(
      expected,
    );
  });
});

describe('customerView', () => {
  it('shows contacts and notes to the desk roles', () => {
    expect(customerView(customer(), true)).toEqual({
      name: 'Rossi Mario',
      anonymized: false,
      tags: ['abituale'],
      email: 'mario.rossi@example.it',
      phone: '+39 333 1234567',
      notes: 'Preferisce la prima fila',
    });
  });

  it('keeps only the name and tags for the other roles', () => {
    expect(customerView(customer(), false)).toEqual({
      name: 'Rossi Mario',
      anonymized: false,
      tags: ['abituale'],
    });
  });

  it('omits missing contacts and blank notes', () => {
    const view = customerView(customer({ email: undefined, phone: '', notes: '   ' }), true);
    expect(view).toEqual({ name: 'Rossi Mario', anonymized: false, tags: ['abituale'] });
  });

  it('shows nothing of an anonymised customer, whatever the role', () => {
    expect(customerView(customer({ anonymized_at: '2026-09-01T00:00:00Z' }), true)).toEqual({
      name: '',
      anonymized: true,
      tags: [],
    });
  });
});

describe('spotLines', () => {
  it('maps assigned and pending lines', () => {
    const b = bookingDetail({
      lines: [
        { ...bookingDetail().lines[0]! },
        {
          id: 'l-2',
          pack_id: 'p-2',
          zone_id: 'z-2',
          assignment_status: 'pending',
          quantity: 2,
          line_total: 1500,
          extras: [{ id: 'e-1', extra_id: 'x-1', quantity: 1, total: 300 }],
        },
      ],
    });
    expect(spotLines(b)).toEqual([
      { id: 'l-1', spot: 'A1', pack: 'OMB-2L', quantity: 1, total: 3000, extras: 0 },
      { id: 'l-2', spot: undefined, pack: undefined, quantity: 2, total: 1500, extras: 1 },
    ]);
  });
});

describe('stayDays', () => {
  it.each([
    ['2026-10-25', '2026-10-25', 1],
    ['2026-10-25', '2026-10-31', 7],
    ['2026-06-01', '2026-09-15', 107],
  ])('%s to %s: %i days', (starts_on, ends_on, expected) => {
    expect(stayDays({ starts_on, ends_on })).toBe(expected);
  });
});

describe('paymentViews', () => {
  it('lists payments oldest first with refunds negative', () => {
    const b = bookingDetail({
      payments: [
        {
          id: 'r',
          provider: 'manual',
          method: 'cash',
          direction: 'refund',
          amount: 400,
          status: 'succeeded',
          created_at: '2026-10-22T09:00:00Z',
        },
        {
          id: 'p',
          provider: 'stripe',
          method: 'card',
          direction: 'in',
          amount: 1000,
          status: 'succeeded',
          created_at: '2026-10-20T09:00:00Z',
          test: true,
        },
      ],
    });
    expect(paymentViews(b)).toEqual([
      {
        id: 'p',
        method: 'card',
        status: 'succeeded',
        refund: false,
        signedAmount: 1000,
        at: '2026-10-20T09:00:00Z',
        test: true,
      },
      {
        id: 'r',
        method: 'cash',
        status: 'succeeded',
        refund: true,
        signedAmount: -400,
        at: '2026-10-22T09:00:00Z',
        test: false,
      },
    ]);
  });
});

describe('historyViews', () => {
  const b = bookingDetail({
    history: [
      { at: '2026-10-20T10:00:00Z', action: 'booking.created', actor_type: 'customer' },
      { at: '2026-10-21T10:00:00Z', action: 'booking.custom_thing', actor_type: 'system' },
      {
        at: '2026-10-22T10:00:00Z',
        action: 'booking.checked_in',
        actor_type: 'user',
        actor_name: 'Luca',
      },
    ],
  });

  it('is newest first, unknown actions generic', () => {
    expect(historyViews(b).map((h) => [h.action, h.actorType, h.actorName])).toEqual([
      ['booking.checked_in', 'user', 'Luca'],
      ['other', 'system', undefined],
      ['booking.created', 'customer', undefined],
    ]);
  });

  it('keeps the latest entries up to the limit', () => {
    expect(historyViews(b, 1).map((h) => h.action)).toEqual(['booking.checked_in']);
  });
});

describe('queuedFor', () => {
  it('keeps the operations of the booking', () => {
    const ops = [
      { id: '1', bookingId: 'b-1' },
      { id: '2', bookingId: 'b-2' },
      { id: '3', bookingId: 'b-1' },
    ] as OfflineOperation[];
    expect(queuedFor(ops, 'b-1').map((o) => o.id)).toEqual(['1', '3']);
  });
});
