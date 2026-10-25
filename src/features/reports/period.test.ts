import { canGoForward, isCurrent, isoWeekday, periodOf, shiftAnchor } from './period';

describe('isoWeekday', () => {
  it.each([
    ['2026-10-19', 1],
    ['2026-10-24', 6],
    ['2026-10-25', 7],
    ['2024-02-29', 4],
  ])('%s → %i', (date, expected) => {
    expect(isoWeekday(date)).toBe(expected);
  });
});

describe('periodOf', () => {
  it.each([
    ['day', '2026-10-25', '2026-10-25', '2026-10-25'],
    ['week on a Sunday', '2026-10-25', '2026-10-19', '2026-10-25'],
    ['week on a Monday', '2026-10-19', '2026-10-19', '2026-10-25'],
    ['week across months', '2026-07-01', '2026-06-29', '2026-07-05'],
    ['week across years', '2027-01-01', '2026-12-28', '2027-01-03'],
  ] as const)('%s (%s)', (name, anchor, from, to) => {
    const range = name.startsWith('week') ? 'week' : 'day';
    expect(periodOf(range, anchor)).toEqual({ from, to });
  });
});

describe('shiftAnchor', () => {
  it.each([
    ['day', '2026-10-25', -1, '2026-10-24'],
    ['day', '2026-02-28', 1, '2026-03-01'],
    ['week', '2026-10-25', -1, '2026-10-18'],
    ['week', '2026-10-18', 1, '2026-10-25'],
  ] as const)('%s %s %i → %s', (range, anchor, direction, expected) => {
    expect(shiftAnchor(range, anchor, direction)).toBe(expected);
  });
});

describe('canGoForward', () => {
  const today = '2026-10-22';
  it.each([
    ['day', '2026-10-22', false],
    ['day', '2026-10-21', true],
    ['week', '2026-10-22', false],
    ['week', '2026-10-15', true],
  ] as const)('%s at %s → %p', (range, anchor, expected) => {
    expect(canGoForward(range, anchor, today)).toBe(expected);
  });
});

describe('isCurrent', () => {
  it.each([
    [{ from: '2026-10-19', to: '2026-10-25' }, '2026-10-22', true],
    [{ from: '2026-10-19', to: '2026-10-25' }, '2026-10-26', false],
    [{ from: '2026-10-22', to: '2026-10-22' }, '2026-10-22', true],
  ])('%j with today %s → %p', (period, today, expected) => {
    expect(isCurrent(period, today)).toBe(expected);
  });
});
