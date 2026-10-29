import type { OperationalSpotStatus } from '@/api/types';
import { operationalBooking, spot } from '@/test/operations-fixtures';

import { GLYPH_PATHS, STATUS_GLYPHS } from './glyphs';
import {
  daysOnSpot,
  indicatorsOf,
  isBookable,
  LEGEND_ORDER,
  markersOf,
  slotStatus,
  SPOT_STATUSES,
  STATUS_CLASSES,
  toSpotStatus,
} from './status';

// The same cases as the panel (web/admin/src/features/operations/lib/status.test.ts).
describe('toSpotStatus', () => {
  it.each<[OperationalSpotStatus, Parameters<typeof toSpotStatus>[1], string]>([
    ['free', undefined, 'free'],
    ['held', undefined, 'hold'],
    ['checked_in', operationalBooking(), 'present'],
    ['pass_holder', operationalBooking({ is_season_pass: true, balance_due: 0 }), 'season'],
    [
      'pass_holder',
      operationalBooking({ is_season_pass: true, balance_due: 210000 }),
      'to_collect',
    ],
    ['released', undefined, 'season_released'],
    ['renewal_offer', undefined, 'renewal_hold'],
    ['blocked', undefined, 'blocked'],
    ['closed', undefined, 'unavailable'],
    ['inactive', undefined, 'unavailable'],
    ['booked', operationalBooking({ channel: 'desk', balance_due: 0 }), 'booked_desk'],
    ['booked', operationalBooking({ channel: 'online', balance_due: 0 }), 'booked_online'],
    ['booked', operationalBooking({ channel: 'api', balance_due: 0 }), 'booked_online'],
    ['booked', operationalBooking({ channel: 'online', balance_due: 500 }), 'to_collect'],
    ['booked', undefined, 'booked_desk'],
  ])('%s (%o) → %s', (status, booking, expected) => {
    expect(toSpotStatus(status, booking)).toBe(expected);
  });

  it('the legend lists every status, so it never depends on the day', () => {
    expect([...LEGEND_ORDER].sort()).toEqual([...SPOT_STATUSES].sort());
  });

  it('every status but free has a glyph, so colour is never alone', () => {
    for (const s of SPOT_STATUSES) {
      const glyph = STATUS_GLYPHS[s];
      if (s === 'free') expect(glyph).toBeNull();
      else expect(GLYPH_PATHS[glyph as NonNullable<typeof glyph>]).toMatch(/^M/);
    }
    const glyphs = SPOT_STATUSES.map((s) => STATUS_GLYPHS[s]).filter(Boolean);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it('every status has theme classes', () => {
    for (const s of SPOT_STATUSES) {
      expect(STATUS_CLASSES[s].bg).toBe(`bg-status-${s.replace(/_/g, '-')}`);
      expect(STATUS_CLASSES[s].fg).toBe(`text-status-${s.replace(/_/g, '-')}-foreground`);
    }
  });
});

describe('slotStatus', () => {
  const s = spot({ status: 'booked', am_status: 'free', pm_status: 'booked' });

  it('uses the half-day status for AM and PM, the day status for FULL', () => {
    expect(slotStatus(s, 'AM')).toBe('free');
    expect(slotStatus(s, 'PM')).toBe('booked');
    expect(slotStatus(s, 'FULL')).toBe('booked');
  });

  it('falls back to the day status without half-day detail', () => {
    expect(slotStatus(spot({ status: 'blocked' }), 'AM')).toBe('blocked');
  });
});

describe('indicatorsOf', () => {
  it('lists ticket to assign, extra, note and VIP (tag in any case)', () => {
    expect(
      indicatorsOf(
        operationalBooking({
          has_extras: true,
          has_notes: true,
          customer_tags: ['VIP'],
          ticket: { id: 't-1', number: 37, label: '#037', needs_assignment: true, version: 1 },
        }),
      ),
    ).toEqual(['to_assign', 'extra', 'note', 'vip']);
    expect(indicatorsOf(operationalBooking())).toEqual([]);
    expect(indicatorsOf(undefined)).toEqual([]);
  });

  it('adds the arrival and departure day (core 1.1, spec 30.4)', () => {
    expect(
      indicatorsOf(operationalBooking({ is_first_day: true, is_last_day: true, has_notes: true })),
    ).toEqual(['note', 'arrival', 'departure']);
  });
});

describe('markersOf', () => {
  it.each([
    ['arrival day', { is_first_day: true }, ['arrival']],
    ['departure day', { is_last_day: true }, ['departure']],
    ['one-day stay', { is_first_day: true, is_last_day: true }, ['arrival', 'departure']],
    ['a day in the middle', { is_first_day: false, is_last_day: false }, []],
    ['an older instance without the fields', {}, []],
  ])('%s', (_name, fields, want) => {
    expect(markersOf(operationalBooking(fields))).toEqual(want);
  });

  it('no booking, no marker', () => {
    expect(markersOf(undefined)).toEqual([]);
  });
});

describe('isBookable', () => {
  it('only free spots and released pass days', () => {
    expect(isBookable('free')).toBe(true);
    expect(isBookable('released')).toBe(true);
    expect(isBookable('booked')).toBe(false);
    expect(isBookable('held')).toBe(false);
  });
});

describe('daysOnSpot', () => {
  it.each([
    ['whole stay', {}, { from: '2026-07-01', to: '2026-07-14' }],
    [
      'segment of a split stay',
      { segment_starts_on: '2026-07-08', segment_ends_on: '2026-07-14' },
      { from: '2026-07-08', to: '2026-07-14' },
    ],
  ])('%s', (_name, segment, want) => {
    expect(
      daysOnSpot(
        operationalBooking({ starts_on: '2026-07-01', ends_on: '2026-07-14', ...segment }),
      ),
    ).toEqual(want);
  });
});
