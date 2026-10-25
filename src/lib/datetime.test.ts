import { formatInstant, formatLongDay, formatTime } from './datetime';

describe('formatInstant', () => {
  it.each([
    ['2026-10-25T08:30:00Z', 'it', 'Europe/Rome', /25 ott.*09:30/],
    ['2026-07-01T08:30:00Z', 'it', 'Europe/Rome', /1 lug.*10:30/],
    ['2026-10-25T08:30:00Z', 'it', undefined, /25 ott.*08:30/],
    ['2026-10-25T08:30:00Z', 'it', 'Not/AZone', /25 ott.*08:30/],
  ])('%s in %s %s', (iso, locale, zone, expected) => {
    expect(formatInstant(iso, locale, zone)).toMatch(expected);
  });
});

describe('formatTime', () => {
  it.each([
    ['2026-10-25T23:30:00Z', 'Europe/Rome', '00:30'],
    [Date.UTC(2026, 9, 25, 8, 5), 'Europe/Rome', '09:05'],
    ['2026-10-25T08:05:00Z', undefined, '08:05'],
  ])('%s in %s', (at, zone, expected) => {
    expect(formatTime(at, 'it', zone)).toBe(expected);
  });
});

describe('formatLongDay', () => {
  it.each([
    ['2026-10-25', 'it', 'domenica 25 ottobre'],
    ['2026-10-25', 'en', 'Sunday, October 25'],
  ])('%s in %s', (date, locale, expected) => {
    expect(formatLongDay(date, locale)).toBe(expected);
  });
});
