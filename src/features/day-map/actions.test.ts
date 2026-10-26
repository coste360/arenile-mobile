import { abilitiesFrom, ROLE_PERMISSIONS } from '@/features/permissions/permissions';
import type { Role } from '@/api/types';
import { mapDocument } from '@/test/map-fixtures';
import { operationalBooking, operationsDay, spot } from '@/test/operations-fixtures';

import { hasAnyAction, NO_ACTIONS, spotActions } from './actions';
import { buildDaySpots } from './model';

const texts = { anonymousShort: 'Anonimo', anonymous: 'Cliente anonimo' };
const TODAY = '2026-10-25';
const TOMORROW = '2026-10-26';

const abilitiesOf = (role: Role) => abilitiesFrom(new Set(ROLE_PERMISSIONS[role]), true);

function daySpot(op: Parameters<typeof spot>[0]) {
  const document = mapDocument();
  const [first] = buildDaySpots({
    document,
    day: operationsDay({ spots: [spot({ spot_id: 's-1', ...op })] }),
    slot: 'FULL',
    canSeeCustomers: true,
    texts,
  });
  if (!first) throw new Error('no spot');
  return first;
}

const booked = daySpot({ status: 'booked', booking: operationalBooking({ status: 'confirmed' }) });
const pass = daySpot({
  status: 'pass_holder',
  booking: operationalBooking({ is_season_pass: true }),
});
const free = daySpot({ status: 'free' });
const blocked = daySpot({ status: 'blocked', block_id: 'blk-1' });

describe('spotActions', () => {
  it.each<[string, ReturnType<typeof daySpot>, Role, string, Partial<typeof NO_ACTIONS>]>([
    ['check-in today for staff', booked, 'beach_staff', TODAY, { checkIn: true }],
    ['no check-in tomorrow', booked, 'beach_staff', TOMORROW, {}],
    ['no check-in for a viewer', booked, 'viewer', TODAY, {}],
    ['release a pass day', pass, 'cashier', TODAY, { releaseDay: true }],
    ['release tomorrow too', pass, 'beach_staff', TOMORROW, { releaseDay: true }],
    ['block a free spot', free, 'manager', TODAY, { block: true }],
    ['viewer cannot block', free, 'viewer', TODAY, {}],
    ['unblock a manual block', blocked, 'owner', TODAY, { unblock: true }],
    // Days from the calendar (ADR 0014): the queued release stays in the
    // offline window, blocks are online and may be planned ahead, past days
    // are read only.
    ['no release the day after tomorrow', pass, 'cashier', '2026-10-27', {}],
    ['no release on a past day', pass, 'cashier', '2026-10-20', {}],
    ['block a free spot next week', free, 'manager', '2026-11-01', { block: true }],
    ['no block on a past day', free, 'manager', '2026-10-20', {}],
    ['unblock next week', blocked, 'owner', '2026-11-01', { unblock: true }],
    ['no unblock on a past day', blocked, 'owner', '2026-10-20', {}],
  ])('%s', (_name, s, role, date, expected) => {
    expect(spotActions(s, abilitiesOf(role), { date, today: TODAY, slot: 'FULL' })).toEqual({
      ...NO_ACTIONS,
      ...expected,
    });
  });

  it('no check-in on a booking that is not confirmed', () => {
    const held = daySpot({
      status: 'booked',
      booking: operationalBooking({ status: 'pending_payment' }),
    });
    expect(
      spotActions(held, abilitiesOf('owner'), { date: TODAY, today: TODAY, slot: 'FULL' }).checkIn,
    ).toBe(false);
  });

  it('no unblock without the block id, nothing while the day is unknown', () => {
    const noId = daySpot({ status: 'blocked' });
    const ctx = { date: TODAY, today: TODAY, slot: 'FULL' as const };
    expect(spotActions(noId, abilitiesOf('owner'), ctx).unblock).toBe(false);
    const [unknown] = buildDaySpots({
      document: mapDocument(),
      day: undefined,
      slot: 'FULL',
      canSeeCustomers: true,
      texts,
    });
    expect(hasAnyAction(spotActions(unknown!, abilitiesOf('owner'), ctx))).toBe(false);
  });

  it('nothing is offered while the role is unknown', () => {
    const none = abilitiesFrom(new Set(), false);
    const ctx = { date: TODAY, today: TODAY, slot: 'FULL' as const };
    for (const s of [booked, pass, free, blocked]) {
      expect(spotActions(s, none, ctx)).toEqual(NO_ACTIONS);
    }
  });
});
