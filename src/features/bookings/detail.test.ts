import type { OfflineOperation } from '@/features/offline/types';
import { abilitiesFrom, ROLE_PERMISSIONS } from '@/features/permissions/permissions';
import type { Role } from '@/api/types';
import { bookingDetail, customer } from '@/test/operations-fixtures';

import {
  agreementView,
  canSeeCustomerContacts,
  customerView,
  guestsView,
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

describe('spotLines of a stay split across spots (core 1.1)', () => {
  const line = bookingDetail().lines[0]!;
  const seg = (
    spot_id: string,
    spot_label: string | undefined,
    starts_on: string,
    ends_on: string,
  ) => ({
    spot_id,
    spot_label,
    starts_on,
    ends_on,
  });
  it.each<[string, (typeof line)['segments'], string | undefined, unknown]>([
    ['no segments', undefined, 'A1', undefined],
    ['an empty segment list', [], 'A1', undefined],
    ['a single segment', [seg('s-1', 'A1', '2026-10-25', '2026-10-30')], 'A1', undefined],
    [
      'two segments',
      [seg('s-2', 'A2', '2026-10-25', '2026-10-27'), seg('s-9', 'B4', '2026-10-28', '2026-10-30')],
      'A1',
      [
        { spot: 'A2', from: '2026-10-25', to: '2026-10-27' },
        { spot: 'B4', from: '2026-10-28', to: '2026-10-30' },
      ],
    ],
    [
      'three segments, one without a label',
      [
        seg('s-2', 'A2', '2026-10-25', '2026-10-26'),
        seg('s-9', undefined, '2026-10-27', '2026-10-28'),
        seg('s-2', 'A2', '2026-10-29', '2026-10-30'),
      ],
      'A1',
      [
        { spot: 'A2', from: '2026-10-25', to: '2026-10-26' },
        { spot: undefined, from: '2026-10-27', to: '2026-10-28' },
        { spot: 'A2', from: '2026-10-29', to: '2026-10-30' },
      ],
    ],
  ])('%s', (_name, segments, spot, expected) => {
    const [view] = spotLines(bookingDetail({ lines: [{ ...line, segments }] }));
    expect(view!.spot).toBe(spot);
    expect(view!.segments).toEqual(expected);
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

describe('agreementView (core 1.1)', () => {
  const agreement = { id: 'ag-1', name: 'Residenti', requirement: 'Residenza nel comune' };
  const hotel = { id: 'pt-1', name: 'Hotel Mare', kind: 'struttura_ricettiva' as const };
  const check = {
    id: 'v-1',
    subject: 'booking' as const,
    agreement_id: 'ag-1',
    requirement: 'Residenza nel comune',
    verified_at: '2026-10-24T09:30:00Z',
    verified_by_name: 'Anna',
  };

  it.each<[string, Parameters<typeof bookingDetail>[0], ReturnType<typeof agreementView>]>([
    ['no agreement and no partner', {}, undefined],
    [
      'agreement with a requirement still to verify',
      { agreement },
      { name: 'Residenti', partner: undefined, requirement: { text: 'Residenza nel comune' } },
    ],
    [
      'requirement verified',
      { agreement, requirement_verification: { ...check, note: ' tessera 2027 ' } },
      {
        name: 'Residenti',
        partner: undefined,
        requirement: {
          text: 'Residenza nel comune',
          verified: { at: '2026-10-24T09:30:00Z', by: 'Anna', note: 'tessera 2027' },
        },
      },
    ],
    [
      'a check of another agreement does not count',
      { agreement, requirement_verification: { ...check, agreement_id: 'ag-old' } },
      { name: 'Residenti', partner: undefined, requirement: { text: 'Residenza nel comune' } },
    ],
    [
      'blank requirement is no requirement',
      { agreement: { ...agreement, requirement: '  ' } },
      { name: 'Residenti', partner: undefined },
    ],
    [
      'partner paying everything, with the guest stay',
      {
        partner: hotel,
        partner_share: { type: 'full' },
        partner_amount: 3000,
        partner_guest_stay: { from: '2026-10-24', to: '2026-10-27' },
      },
      {
        name: undefined,
        partner: 'Hotel Mare',
        share: { kind: 'full' },
        partnerAmount: 3000,
        guestStay: { from: '2026-10-24', to: '2026-10-27' },
      },
    ],
    [
      'partner of the agreement, percent share',
      {
        agreement: { id: 'ag-2', name: 'Hotel', partner_name: 'Hotel Sole' },
        partner_share: { type: 'percent', percent: '12.5' },
        partner_amount: 375,
      },
      {
        name: 'Hotel',
        partner: 'Hotel Sole',
        share: { kind: 'percent', percent: 12.5 },
        partnerAmount: 375,
      },
    ],
    [
      'fixed amount share',
      { partner: hotel, partner_share: { type: 'amount', amount: 1000 }, partner_amount: 1000 },
      {
        name: undefined,
        partner: 'Hotel Mare',
        share: { kind: 'amount', amount: 1000 },
        partnerAmount: 1000,
      },
    ],
    [
      'share none shows no share nor amount',
      { partner: hotel, partner_share: { type: 'none' }, partner_amount: 0 },
      { name: undefined, partner: 'Hotel Mare' },
    ],
  ])('%s', (_name, overrides, expected) => {
    expect(agreementView(bookingDetail(overrides))).toEqual(expected);
  });
});

describe('guestsView (core 1.1)', () => {
  it.each<[string, Parameters<typeof bookingDetail>[0], ReturnType<typeof guestsView>]>([
    ['nothing about guests', {}, undefined],
    [
      'blank fields and zero people',
      { group_name: ' ', party_adults: 0, guest_names: [' '] },
      undefined,
    ],
    [
      'group, origin, people and names',
      {
        group_name: 'Famiglia Bianchi ',
        group_origin: 'Milano',
        party_adults: 2,
        party_children: 1,
        guest_names: ['Luca Bianchi', ' ', 'Sara Bianchi'],
      },
      {
        group: 'Famiglia Bianchi',
        origin: 'Milano',
        adults: 2,
        children: 1,
        names: ['Luca Bianchi', 'Sara Bianchi'],
      },
    ],
    [
      'anonymised customer hides the guests',
      {
        customer: customer({ anonymized_at: '2026-10-01T00:00:00Z' }),
        group_name: 'Famiglia Bianchi',
        guest_names: ['Luca Bianchi'],
      },
      undefined,
    ],
  ])('%s', (_name, overrides, expected) => {
    expect(guestsView(bookingDetail(overrides))).toEqual(expected);
  });
});
