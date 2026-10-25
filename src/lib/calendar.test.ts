import {
  addDays,
  daysBetween,
  formatDayLabel,
  isCalendarDate,
  operationalDays,
  stayIncludes,
  todayIn,
} from './calendar';

describe('todayIn', () => {
  it.each([
    // Late evening UTC is already tomorrow in Rome (summer time, UTC+2).
    ['2026-07-14T22:30:00Z', 'Europe/Rome', '2026-07-15'],
    ['2026-07-14T21:59:59Z', 'Europe/Rome', '2026-07-14'],
    // Winter time (UTC+1): the switch happens at 23:00 UTC.
    ['2026-01-10T22:59:59Z', 'Europe/Rome', '2026-01-10'],
    ['2026-01-10T23:00:00Z', 'Europe/Rome', '2026-01-11'],
    // The day of the change to winter time (last Sunday of October).
    ['2026-10-25T08:00:00Z', 'Europe/Rome', '2026-10-25'],
    // West of UTC.
    ['2026-07-15T03:00:00Z', 'America/New_York', '2026-07-14'],
    // Missing or unknown zone: UTC.
    ['2026-07-14T23:30:00Z', undefined, '2026-07-14'],
    ['2026-07-14T23:30:00Z', 'Mars/Olympus_Mons', '2026-07-14'],
  ])('%s in %s is %s', (instant, zone, expected) => {
    expect(todayIn(zone, new Date(instant))).toBe(expected);
  });
});

describe('addDays and daysBetween', () => {
  it.each([
    ['2026-07-14', 1, '2026-07-15'],
    ['2026-07-31', 1, '2026-08-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-03-01', -1, '2026-02-28'],
    // Across the DST change the calendar day still moves by one.
    ['2026-10-24', 1, '2026-10-25'],
    ['2026-03-29', 1, '2026-03-30'],
  ])('%s %+d → %s', (date, n, expected) => {
    expect(addDays(date, n)).toBe(expected);
    expect(daysBetween(date, expected)).toBe(n);
  });
});

describe('isCalendarDate', () => {
  it.each([
    ['2026-07-14', true],
    ['2028-02-29', true],
    ['2026-02-29', false],
    ['2026-13-01', false],
    ['2026-7-14', false],
    ['2026-07-14T00:00:00Z', false],
    [20260714, false],
    [null, false],
  ])('%p → %p', (v, expected) => {
    expect(isCalendarDate(v)).toBe(expected);
  });
});

describe('operationalDays', () => {
  it('returns today and tomorrow in the establishment zone', () => {
    expect(operationalDays('Europe/Rome', new Date('2026-07-14T22:30:00Z'))).toEqual({
      today: '2026-07-15',
      tomorrow: '2026-07-16',
    });
  });
});

describe('stayIncludes', () => {
  const stay = { starts_on: '2026-07-10', ends_on: '2026-07-14' };
  it.each([
    ['2026-07-09', false],
    ['2026-07-10', true],
    ['2026-07-14', true],
    ['2026-07-15', false],
  ])('%s → %p', (date, expected) => {
    expect(stayIncludes(stay, date)).toBe(expected);
  });
});

describe('formatDayLabel', () => {
  it('formats the calendar day whatever the device zone', () => {
    expect(formatDayLabel('2026-10-25', 'it-IT')).toMatch(/25/);
    expect(formatDayLabel('2026-10-25', 'it-IT')).toMatch(/ott/);
  });
});
