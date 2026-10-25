import type { OperationalSpot } from '@/api/types';
import { operationsDay, spot } from '@/test/operations-fixtures';

import {
  daySpotFigures,
  isFree,
  isReleased,
  isSpotFilter,
  releasedHalf,
  spotsOf,
} from './day-spots';

const s = (overrides: Partial<OperationalSpot>) => spot(overrides);

describe('spot predicates', () => {
  it.each<[string, Partial<OperationalSpot>, boolean, boolean]>([
    ['free', { status: 'free' }, true, false],
    ['released all day', { status: 'released' }, true, true],
    [
      'released in the morning only',
      { status: 'pass_holder', am_status: 'released', pm_status: 'pass_holder' },
      false,
      true,
    ],
    [
      'released in the afternoon, booked in the morning',
      { status: 'booked', am_status: 'booked', pm_status: 'released' },
      false,
      true,
    ],
    ['booked', { status: 'booked' }, false, false],
    ['blocked', { status: 'blocked' }, false, false],
    ['closed', { status: 'closed' }, false, false],
    ['inactive', { status: 'inactive' }, false, false],
  ])('%s', (_name, overrides, free, released) => {
    expect(isFree(s(overrides))).toBe(free);
    expect(isReleased(s(overrides))).toBe(released);
  });
});

describe('releasedHalf', () => {
  it.each<[Partial<OperationalSpot>, string]>([
    [{ status: 'released' }, 'FULL'],
    [{ status: 'pass_holder', am_status: 'released', pm_status: 'released' }, 'FULL'],
    [{ status: 'pass_holder', am_status: 'released', pm_status: 'pass_holder' }, 'AM'],
    [{ status: 'pass_holder', am_status: 'pass_holder', pm_status: 'released' }, 'PM'],
  ])('%j -> %s', (overrides, expected) => {
    expect(releasedHalf(s(overrides))).toBe(expected);
  });
});

describe('spotsOf and daySpotFigures', () => {
  const day = operationsDay({
    spots: [
      s({ spot_id: '1', label: 'A10', status: 'free' }),
      s({ spot_id: '2', label: 'A2', status: 'released', release_id: 'r-1' }),
      s({ spot_id: '3', label: 'A1', status: 'booked' }),
      s({
        spot_id: '4',
        label: 'B1',
        status: 'pass_holder',
        am_status: 'released',
        pm_status: 'pass_holder',
      }),
      s({ spot_id: '5', label: 'B2', status: 'inactive' }),
    ],
    totals: { ...operationsDay().totals, spots: 4 },
  });

  it('lists the free spots in natural order', () => {
    expect(spotsOf(day, 'free').map((x) => x.label)).toEqual(['A2', 'A10']);
  });

  it('lists the released spots, half days included', () => {
    expect(spotsOf(day, 'released').map((x) => x.label)).toEqual(['A2', 'B1']);
  });

  it('counts what the lists show', () => {
    expect(daySpotFigures(day)).toEqual({ free: 2, released: 2, total: 4 });
  });
});

it.each([
  ['free', true],
  ['released', true],
  ['booked', false],
  [undefined, false],
])('isSpotFilter(%j) is %s', (v, expected) => {
  expect(isSpotFilter(v)).toBe(expected);
});
