import type { OperationalSpotStatus } from '@/api/types';

import {
  blockRange,
  spotBlockAction,
  toSpotBlockCreate,
  type SpotBlockAction,
} from './spot-blocks';

describe('blockRange', () => {
  it.each([
    ['today', { starts_on: '2026-10-25', ends_on: '2026-10-25' }],
    ['tomorrow', { starts_on: '2026-10-26', ends_on: '2026-10-26' }],
    ['today_and_tomorrow', { starts_on: '2026-10-25', ends_on: '2026-10-26' }],
  ] as const)('%s', (period, want) => {
    expect(blockRange(period, '2026-10-25')).toEqual(want);
  });

  it('crosses the end of the month', () => {
    expect(blockRange('today_and_tomorrow', '2026-10-31')).toEqual({
      starts_on: '2026-10-31',
      ends_on: '2026-11-01',
    });
  });
});

describe('toSpotBlockCreate', () => {
  it('blocks one spot with a trimmed reason', () => {
    expect(
      toSpotBlockCreate({
        spotId: 's-1',
        period: 'today',
        slots: 'AM',
        reason: '  Ombrellone rotto ',
        today: '2026-10-25',
      }),
    ).toEqual({
      spot_ids: ['s-1'],
      starts_on: '2026-10-25',
      ends_on: '2026-10-25',
      slots: 'AM',
      reason: 'Ombrellone rotto',
    });
  });

  it('omits an empty reason', () => {
    expect(
      toSpotBlockCreate({
        spotId: 's-1',
        period: 'tomorrow',
        slots: 'FULL',
        reason: '   ',
        today: '2026-10-25',
      }),
    ).not.toHaveProperty('reason');
  });
});

describe('spotBlockAction', () => {
  it.each<[OperationalSpotStatus, string | undefined, SpotBlockAction]>([
    ['free', undefined, 'block'],
    ['released', undefined, 'block'],
    ['blocked', 'blk-1', 'unblock'],
    ['blocked', undefined, 'none'],
    ['booked', undefined, 'none'],
    ['checked_in', undefined, 'none'],
    ['pass_holder', undefined, 'none'],
    ['held', undefined, 'none'],
    ['closed', undefined, 'none'],
    ['inactive', undefined, 'none'],
  ])('%s (block %s) → %s', (status, block_id, want) => {
    expect(spotBlockAction({ status, block_id })).toBe(want);
  });
});
