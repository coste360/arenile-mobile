import type { OperationalSpotStatus } from '@/api/types';
import { operationalBooking, spot } from '@/test/operations-fixtures';

import { slotOccupancy, slotSegments, slotUse, type HalfDay, type SlotUse } from './slot-occupancy';

describe('slotUse', () => {
  it.each<[string, OperationalSpotStatus, HalfDay, SlotUse]>([
    ['free', 'free', 'AM', 'free'],
    ['released pass day', 'released', 'PM', 'free'],
    ['booked', 'booked', 'AM', 'occupied'],
    ['present', 'checked_in', 'AM', 'occupied'],
    ['season pass', 'pass_holder', 'PM', 'occupied'],
    ['hold', 'held', 'AM', 'occupied'],
    ['renewal offer', 'renewal_offer', 'AM', 'occupied'],
    ['blocked', 'blocked', 'PM', 'closed'],
    ['closed', 'closed', 'AM', 'closed'],
    ['inactive', 'inactive', 'PM', 'closed'],
  ])('%s (%s) in the %s → %s', (_name, status, half, expected) => {
    expect(slotUse(spot({ status }), half)).toBe(expected);
  });

  it.each<[string, Partial<Parameters<typeof spot>[0]>, SlotUse, SlotUse]>([
    [
      'morning booking only',
      { status: 'booked', am_status: 'booked', pm_status: 'free' },
      'occupied',
      'free',
    ],
    [
      'afternoon released by the pass holder',
      { status: 'pass_holder', am_status: 'pass_holder', pm_status: 'released' },
      'occupied',
      'free',
    ],
    ['blocked in the morning', { status: 'free', am_status: 'blocked' }, 'closed', 'free'],
    [
      'to collect counts as occupied',
      { status: 'booked', booking: operationalBooking({ balance_due: 500 }) },
      'occupied',
      'occupied',
    ],
  ])('%s', (_name, overrides, am, pm) => {
    const s = spot(overrides);
    expect([slotUse(s, 'AM'), slotUse(s, 'PM')]).toEqual([am, pm]);
  });
});

describe('slotSegments', () => {
  it.each([
    [
      'all three uses',
      { occupied: 3, free: 2, closed: 1, total: 6 },
      [
        { use: 'occupied', x: 0, width: 3 },
        { use: 'free', x: 3, width: 2 },
        { use: 'closed', x: 5, width: 1 },
      ],
    ],
    [
      'an empty use is skipped',
      { occupied: 0, free: 4, closed: 1, total: 5 },
      [
        { use: 'free', x: 0, width: 4 },
        { use: 'closed', x: 4, width: 1 },
      ],
    ],
    ['no spots', { occupied: 0, free: 0, closed: 0, total: 0 }, []],
  ])('%s', (_name, counts, segments) => {
    expect(slotSegments(counts)).toEqual(segments);
  });
});

describe('slotOccupancy', () => {
  it('counts every spot once per slot', () => {
    const spots = [
      spot({ spot_id: 's-1', status: 'booked', am_status: 'booked', pm_status: 'free' }),
      spot({ spot_id: 's-2', status: 'checked_in' }),
      spot({ spot_id: 's-3', status: 'free' }),
      spot({
        spot_id: 's-4',
        status: 'pass_holder',
        am_status: 'released',
        pm_status: 'pass_holder',
      }),
      spot({ spot_id: 's-5', status: 'blocked' }),
    ];
    expect(slotOccupancy(spots)).toEqual({
      AM: { occupied: 2, free: 2, closed: 1, total: 5 },
      PM: { occupied: 2, free: 2, closed: 1, total: 5 },
    });
  });

  it('is empty without spots', () => {
    const empty = { occupied: 0, free: 0, closed: 0, total: 0 };
    expect(slotOccupancy([])).toEqual({ AM: empty, PM: empty });
  });
});
