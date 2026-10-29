import { NetworkError, ProblemError } from '@/api/errors';
import type { BookingStatus } from '@/api/types';
import { abilitiesFrom, ROLE_PERMISSIONS } from '@/features/permissions/permissions';
import { bookingDetail, operationalBooking, operationsDay, spot } from '@/test/operations-fixtures';

import {
  canMove,
  lastMoveOf,
  lineSpotOn,
  lineSpotsFrom,
  movable,
  movableLines,
  moveErrorKey,
  moveFrom,
  moveStarts,
  priceChange,
  swapCandidates,
  targetDay,
  targetSpots,
  toMoveRequest,
  toSwapRequest,
  undoErrorKey,
  undoOpen,
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

describe('lineSpotOn', () => {
  const line = bookingDetail().lines[0]!;
  const split = {
    ...line,
    segments: [
      { spot_id: 's-1', spot_label: 'A1', starts_on: '2026-10-20', ends_on: '2026-10-24' },
      { spot_id: 's-2', spot_label: 'A2', starts_on: '2026-10-25', ends_on: '2026-10-30' },
    ],
  };
  it.each<[string, typeof split | typeof line, string, { spotId?: string; label?: string }]>([
    ['no segments: the line spot', line, '2026-10-25', { spotId: 's-1', label: 'A1' }],
    ['a day inside the first segment', split, '2026-10-22', { spotId: 's-1', label: 'A1' }],
    ['a day inside the second segment', split, '2026-10-27', { spotId: 's-2', label: 'A2' }],
    ['the first day of a segment', split, '2026-10-25', { spotId: 's-2', label: 'A2' }],
    ['the last day of a segment', split, '2026-10-24', { spotId: 's-1', label: 'A1' }],
    ['the last day of the stay', split, '2026-10-30', { spotId: 's-2', label: 'A2' }],
    [
      'a day outside every segment: the line spot',
      { ...split, spot_id: 's-9', spot_label: 'Z9' },
      '2026-10-31',
      { spotId: 's-9', label: 'Z9' },
    ],
  ])('%s', (_name, l, day, expected) => {
    expect(lineSpotOn(l, day)).toEqual(expected);
  });
});

describe('lineSpotsFrom', () => {
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
  const split = {
    ...line,
    segments: [
      seg('s-1', 'A1', '2026-10-20', '2026-10-24'),
      seg('s-2', 'A2', '2026-10-25', '2026-10-27'),
      seg('s-3', 'B4', '2026-10-28', '2026-10-30'),
    ],
  };
  it.each<[string, typeof split | typeof line, string, (string | undefined)[]]>([
    ['no segments: the line spot', line, '2026-10-25', ['A1']],
    ['from the first day: every segment', split, '2026-10-20', ['A1', 'A2', 'B4']],
    ['from the middle: the segments still to come', split, '2026-10-26', ['A2', 'B4']],
    ['from the last segment: its spot only', split, '2026-10-29', ['B4']],
    [
      'an unlabelled segment stays in place',
      {
        ...split,
        segments: [
          seg('s-2', 'A2', '2026-10-25', '2026-10-27'),
          seg('s-9', undefined, '2026-10-28', '2026-10-30'),
        ],
      },
      '2026-10-25',
      ['A2', undefined],
    ],
  ])('%s', (_name, l, day, expected) => {
    expect(lineSpotsFrom(l, day)).toEqual(expected);
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

describe('moveStarts and moveFrom with a start', () => {
  it.each<[string, string, string, string[], string | undefined, string | undefined]>([
    // name, starts_on, ends_on, choices, from today, from tomorrow
    ['a future stay: the whole stay', '2026-10-27', '2026-10-30', [], undefined, undefined],
    ['a one-day stay today', '2026-10-25', '2026-10-25', [], undefined, undefined],
    ['a stay ending today', '2026-10-20', '2026-10-25', [], '2026-10-25', '2026-10-25'],
    [
      'a stay starting today',
      '2026-10-25',
      '2026-10-28',
      ['today', 'tomorrow'],
      undefined,
      '2026-10-26',
    ],
    [
      'a stay under way',
      '2026-10-20',
      '2026-10-28',
      ['today', 'tomorrow'],
      '2026-10-25',
      '2026-10-26',
    ],
  ])('%s', (_name, starts_on, ends_on, choices, fromToday, fromTomorrow) => {
    const b = { starts_on, ends_on };
    expect(moveStarts(b, '2026-10-25')).toEqual(choices);
    expect(moveFrom(b, '2026-10-25', 'today')).toBe(fromToday);
    expect(moveFrom(b, '2026-10-25', 'tomorrow')).toBe(fromTomorrow);
  });
});

describe('swapCandidates', () => {
  const day = operationsDay({
    spots: [
      spot({ spot_id: 's-1', label: 'A1', status: 'free' }),
      spot({
        spot_id: 's-2',
        label: 'A2',
        status: 'booked',
        booking: operationalBooking({ booking_id: 'b-1', line_id: 'l-1' }),
      }),
      spot({
        spot_id: 's-3',
        label: 'A3',
        status: 'booked',
        booking: operationalBooking({ booking_id: 'b-3', line_id: 'l-3' }),
      }),
      spot({
        spot_id: 's-4',
        label: 'B1',
        status: 'booked',
        booking: operationalBooking({ booking_id: 'b-4', line_id: 'l-4', status: 'completed' }),
      }),
      spot({
        spot_id: 's-5',
        label: 'B2',
        status: 'booked',
        booking: operationalBooking({
          booking_id: 'b-5',
          line_id: 'l-5',
          ticket: { id: 't-1', number: 1, label: 'n1', needs_assignment: false, version: 1 },
        }),
      }),
      spot({
        spot_id: 's-6',
        label: 'B3',
        status: 'booked',
        booking: operationalBooking({ booking_id: 'b-6', line_id: undefined }),
      }),
      spot({
        spot_id: 's-7',
        label: 'B4',
        status: 'booked',
        booking: operationalBooking({ booking_id: 'b-7', line_id: 'l-7' }),
      }),
    ],
  });

  it('offers the other modifiable bookings on a line, not tickets nor the booking itself', () => {
    expect(swapCandidates(day, 'b-1', '').spots.map((s) => s.label)).toEqual(['A3', 'B4']);
  });

  it('filters by label', () => {
    expect(swapCandidates(day, 'b-1', 'b').spots.map((s) => s.label)).toEqual(['B4']);
  });

  it('is empty without the day', () => {
    expect(swapCandidates(undefined, 'b-1', '').spots).toEqual([]);
  });
});

describe('toSwapRequest', () => {
  const other = { booking_id: 'b-9', line_id: 'l-9', version: 4 };

  it('sends both sides at the version seen, from the first day moved', () => {
    expect(
      toSwapRequest({
        bookingId: 'b-1',
        lineId: 'l-1',
        version: 2,
        other,
        from: '2026-10-26',
        dryRun: false,
      }),
    ).toEqual({
      a: { booking_id: 'b-1', line_id: 'l-1', expected_version: 2 },
      b: { booking_id: 'b-9', line_id: 'l-9', expected_version: 4 },
      from: '2026-10-26',
    });
  });

  it('marks the preview as a dry run', () => {
    expect(
      toSwapRequest({
        bookingId: 'b-1',
        lineId: 'l-1',
        version: 2,
        other,
        from: '2026-10-25',
        dryRun: true,
      }).dry_run,
    ).toBe(true);
  });
});

describe('undoOpen and lastMoveOf', () => {
  const now = new Date('2026-10-25T08:00:00Z');
  const info = (expires_at: string, booking_ids = ['b-1']) => ({
    move_id: 'm-1',
    kind: 'move' as const,
    expires_at,
    booking_ids,
  });

  it.each<[string, ReturnType<typeof info> | undefined, boolean]>([
    ['before the expiry', info('2026-10-25T08:04:59Z'), true],
    ['at the expiry', info('2026-10-25T08:00:00Z'), false],
    ['after the expiry', info('2026-10-25T07:59:00Z'), false],
    ['no undo', undefined, false],
  ])('%s', (_name, i, open) => {
    expect(undoOpen(i, now)).toBe(open);
  });

  it.each<[string, Parameters<typeof lastMoveOf>[0], string | undefined]>([
    ['the last move of this booking', { move: info('2026-10-25T08:03:00Z') }, 'm-1'],
    [
      'a swap with this booking on the other side',
      { move: info('2026-10-25T08:03:00Z', ['b-2', 'b-1']) },
      'm-1',
    ],
    [
      'the last move of another booking',
      { move: info('2026-10-25T08:03:00Z', ['b-2']) },
      undefined,
    ],
    ['an expired move', { move: info('2026-10-25T07:58:00Z') }, undefined],
    ['no move', {}, undefined],
    ['not loaded', undefined, undefined],
  ])('%s', (_name, last, moveId) => {
    expect(lastMoveOf(last, 'b-1', now)?.move_id).toBe(moveId);
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
    ['swap not possible', problem(409, 'swap_conflict'), 'move.swap.errors.conflict'],
    ['not modifiable', problem(409, 'conflict'), 'move.errors.not_modifiable'],
    ['approval needed', problem(422, 'policy_violation'), 'move.errors.policy'],
    ['invalid spot', problem(422, 'validation_failed'), 'move.errors.invalid'],
    ['gone', problem(404, 'not_found'), 'move.errors.not_found'],
    ['other', problem(500, 'internal_error'), 'move.errors.default'],
  ])('%s', (_name, e, key) => {
    expect(moveErrorKey(e)).toBe(key);
  });
});

describe('undoErrorKey', () => {
  it.each<[string, unknown, string]>([
    ['offline', new NetworkError('timeout'), 'move.undo.errors.offline'],
    ['403', problem(403, 'forbidden'), 'move.undo.errors.forbidden'],
    ['after 5 minutes', problem(410, 'move_undo_expired'), 'move.undo.errors.expired'],
    ['already undone', problem(404, 'not_found'), 'move.undo.errors.expired'],
    ['spots taken', problem(409, 'move_undo_conflict'), 'move.undo.errors.conflict'],
    ['booking changed', problem(409, 'conflict'), 'move.undo.errors.conflict'],
    ['other', problem(500, 'internal_error'), 'move.undo.errors.default'],
  ])('%s', (_name, e, key) => {
    expect(undoErrorKey(e)).toBe(key);
  });
});
