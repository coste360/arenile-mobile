import type { SpotCalendarBooking, SpotCalendarCell, SpotCalendarDay } from '@/api/types';
import { ROLE_PERMISSIONS, resolveAbilities } from '@/features/permissions/permissions';

import { bookingOfDay, calendarMonths, canViewSpotCalendar, cellStatus } from './spot-calendar';

const booking = (id: string, balance: number): SpotCalendarBooking => ({
  booking_id: id,
  code: `AR-${id}`,
  status: 'confirmed',
  starts_on: '2026-07-01',
  ends_on: '2026-07-03',
  is_season_pass: false,
  balance_due: balance,
});

const BOOKINGS = new Map([
  ['paid', booking('paid', 0)],
  ['due', booking('due', 1500)],
]);

const free: SpotCalendarCell = { status: 'free' };
const day = (date: string, am = free, pm = free): SpotCalendarDay => ({ date, am, pm });

// The same cases as the panel (web/admin/src/features/operations/lib/spotCalendar.ts).
describe('cellStatus', () => {
  it.each<[string, SpotCalendarCell, string]>([
    ['free', free, 'free'],
    ['booked and paid', { status: 'booked', booking_id: 'paid' }, 'booked_desk'],
    ['booked with a balance', { status: 'booked', booking_id: 'due' }, 'to_collect'],
    ['season pass', { status: 'season_pass', booking_id: 'paid' }, 'season'],
    ['season pass with a balance', { status: 'season_pass', booking_id: 'due' }, 'to_collect'],
    ['booking not in the list', { status: 'booked', booking_id: 'gone' }, 'booked_desk'],
    ['released pass day', { status: 'released' }, 'season_released'],
    ['held', { status: 'held' }, 'hold'],
    ['blocked', { status: 'blocked' }, 'blocked'],
    ['closed', { status: 'closed' }, 'unavailable'],
    ['inactive', { status: 'inactive' }, 'unavailable'],
  ])('%s', (_name, cell, want) => {
    expect(cellStatus(cell, BOOKINGS)).toBe(want);
  });
});

describe('calendarMonths', () => {
  it('lays the season out in weeks from Monday, months without season days left out', () => {
    // 2026-06-29 is a Monday, 2026-07-01 a Wednesday.
    const months = calendarMonths([day('2026-07-01'), day('2026-07-02'), day('2026-06-30')]);
    expect(months.map((m) => m.key)).toEqual(['2026-06', '2026-07']);
    const july = months[1]!;
    expect(july.weeks).toHaveLength(5);
    expect(july.weeks[0]!.map((d) => d?.date ?? null)).toEqual([
      null,
      null,
      '2026-07-01',
      '2026-07-02',
      null,
      null,
      null,
    ]);
    expect(july.weeks.every((w) => w.length === 7)).toBe(true);
    // June 2026 starts on a Monday: 30 days in 5 weeks, the 30th on the last Tuesday.
    const june = months[0]!;
    expect(june.weeks).toHaveLength(5);
    expect(june.weeks[4]![1]?.date).toBe('2026-06-30');
  });

  it('is empty without days', () => {
    expect(calendarMonths([])).toEqual([]);
  });
});

describe('bookingOfDay', () => {
  it.each<[string, SpotCalendarDay, string | undefined]>([
    [
      'whole day',
      day(
        '2026-07-01',
        { status: 'booked', booking_id: 'a' },
        { status: 'booked', booking_id: 'a' },
      ),
      'a',
    ],
    ['afternoon only', day('2026-07-01', free, { status: 'booked', booking_id: 'b' }), 'b'],
    [
      'morning first',
      day(
        '2026-07-01',
        { status: 'booked', booking_id: 'a' },
        { status: 'booked', booking_id: 'b' },
      ),
      'a',
    ],
    ['free', day('2026-07-01'), undefined],
  ])('%s', (_name, d, want) => {
    expect(bookingOfDay(d)).toBe(want);
  });
});

describe('canViewSpotCalendar', () => {
  it.each(Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[])(
    '%s reads the calendar (bookings.read or operations.run)',
    (role) => {
      const a = resolveAbilities({ role, establishmentId: 'e-1', me: undefined });
      expect(canViewSpotCalendar(a)).toBe(true);
    },
  );

  it('not without bookings.read and operations.run', () => {
    expect(canViewSpotCalendar({ canViewBookings: false, canCheckIn: false })).toBe(false);
  });
});
