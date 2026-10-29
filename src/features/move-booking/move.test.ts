import { NetworkError, ProblemError } from '@/api/errors';
import type { BookingStatus } from '@/api/types';
import { abilitiesFrom, ROLE_PERMISSIONS } from '@/features/permissions/permissions';
import { bookingDetail, operationsDay, spot } from '@/test/operations-fixtures';

import {
  canMove,
  movable,
  movableLines,
  moveErrorKey,
  moveFrom,
  priceChange,
  targetDay,
  targetSpots,
  toMoveRequest,
} from './move';

const problem = (status: number, type: string) =>
  new ProblemError(status, { type: type as never, title: type, status });

describe('canMove', () => {
  it.each([
    ['owner', true],
    ['manager', true],
    ['cashier', true],
    ['beach_staff', false],
    ['viewer', false],
  ] as const)('%s → %p', (role, expected) => {
    expect(canMove(abilitiesFrom(new Set(ROLE_PERMISSIONS[role]), true))).toBe(expected);
  });
});

describe('movable', () => {
  it.each<[BookingStatus, string, boolean]>([
    ['confirmed', '2026-10-25', true],
    ['checked_in', '2026-10-27', true],
    ['awaiting_approval', '2026-10-25', true],
    ['confirmed', '2026-10-24', false],
    ['cancelled', '2026-10-25', false],
    ['completed', '2026-10-25', false],
    ['no_show', '2026-10-25', false],
  ])('%s ending %s → %p', (status, ends_on, expected) => {
    expect(movable({ status, ends_on }, '2026-10-25')).toBe(expected);
  });
});

describe('movableLines', () => {
  it('keeps the lines placed on a spot', () => {
    const b = bookingDetail();
    const lines = [
      ...b.lines,
      { ...b.lines[0]!, id: 'l-2', spot_id: undefined, spot_label: undefined },
    ];
    expect(movableLines({ lines }).map((l) => l.id)).toEqual(['l-1']);
  });
});

describe('moveFrom and targetDay', () => {
  it.each<[string, string, string, string | undefined, string]>([
    ['a one-day stay today', '2026-10-25', '2026-10-25', undefined, '2026-10-25'],
    ['a future stay', '2026-10-27', '2026-10-30', undefined, '2026-10-27'],
    ['a stay under way', '2026-10-20', '2026-10-30', '2026-10-25', '2026-10-25'],
    ['a stay ending today', '2026-10-20', '2026-10-25', '2026-10-25', '2026-10-25'],
  ])('%s', (_name, starts_on, ends_on, from, day) => {
    const b = { starts_on, ends_on };
    expect(moveFrom(b, '2026-10-25')).toBe(from);
    expect(targetDay(b, moveFrom(b, '2026-10-25'))).toBe(day);
  });
});

describe('targetSpots', () => {
  const day = operationsDay({
    spots: [
      spot({ spot_id: 's-1', label: 'A1', status: 'booked' }),
      spot({ spot_id: 's-2', label: 'A10', status: 'free' }),
      spot({ spot_id: 's-3', label: 'A2', status: 'released' }),
      spot({ spot_id: 's-4', label: 'B1', status: 'blocked' }),
      spot({ spot_id: 's-5', label: 'B2', status: 'booked', pm_status: 'free' }),
    ],
  });

  it('offers the free spots for the slots, in natural order, without the current one', () => {
    expect(targetSpots(day, 'FULL', 's-3', '').spots.map((s) => s.label)).toEqual(['A10']);
    expect(targetSpots(day, 'FULL', 's-1', '').spots.map((s) => s.label)).toEqual(['A2', 'A10']);
    expect(targetSpots(day, 'PM', 's-1', '').spots.map((s) => s.label)).toEqual([
      'A2',
      'A10',
      'B2',
    ]);
  });

  it('filters by label', () => {
    expect(targetSpots(day, 'PM', 's-1', 'b').spots.map((s) => s.label)).toEqual(['B2']);
  });

  it('is empty without the day', () => {
    expect(targetSpots(undefined, 'FULL', undefined, '').spots).toEqual([]);
  });
});

describe('toMoveRequest', () => {
  it('sends from and dry_run only when set', () => {
    expect(toMoveRequest({ lineId: 'l-1', spotId: 's-2', dryRun: false })).toEqual({
      line_id: 'l-1',
      spot_id: 's-2',
    });
    expect(
      toMoveRequest({ lineId: 'l-1', spotId: 's-2', from: '2026-10-25', dryRun: true }),
    ).toEqual({ line_id: 'l-1', spot_id: 's-2', from: '2026-10-25', dry_run: true });
  });
});

describe('priceChange', () => {
  it.each([
    [500, 'up'],
    [-500, 'down'],
    [0, 'same'],
  ] as const)('%d → %s', (difference, expected) => {
    expect(priceChange({ price_difference: difference })).toBe(expected);
  });
});

describe('moveErrorKey', () => {
  it.each<[string, unknown, string]>([
    ['offline', new NetworkError('unreachable'), 'move.errors.offline'],
    ['403', problem(403, 'forbidden'), 'move.errors.forbidden'],
    ['taken', problem(409, 'spot_unavailable'), 'move.errors.spot_unavailable'],
    ['zone full', problem(409, 'pool_exhausted'), 'move.errors.spot_unavailable'],
    [
      'agreement quota used up',
      problem(409, 'agreement_quota_exceeded'),
      'move.errors.spot_unavailable',
    ],
    ['changed meanwhile', problem(412, 'version_conflict'), 'move.errors.version_conflict'],
    ['not modifiable', problem(409, 'conflict'), 'move.errors.not_modifiable'],
    ['approval needed', problem(422, 'policy_violation'), 'move.errors.policy'],
    ['invalid spot', problem(422, 'validation_failed'), 'move.errors.invalid'],
    ['gone', problem(404, 'not_found'), 'move.errors.not_found'],
    ['other', problem(500, 'internal_error'), 'move.errors.default'],
  ])('%s', (_name, e, key) => {
    expect(moveErrorKey(e)).toBe(key);
  });
});
