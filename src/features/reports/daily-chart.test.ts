import type { ComparisonPoint } from '@/api/types';

import { BAR_SCALE, MIN_BAR, barHeight, dailyBars } from './daily-chart';

const point = (date: string, overrides: Partial<ComparisonPoint> = {}): ComparisonPoint => ({
  key: date,
  label: date,
  current_from: date,
  previous_from: date.replace('2026', '2025'),
  current_revenue: 0,
  previous_revenue: 0,
  current_occupancy_bp: 0,
  previous_occupancy_bp: 0,
  current_bookings: 0,
  previous_bookings: 0,
  ...overrides,
});

describe('barHeight', () => {
  it.each([
    ['zero', 0, 1000, 0],
    ['negative (refunds)', -500, 1000, 0],
    ['no scale', 10, 0, 0],
    ['full', 1000, 1000, BAR_SCALE],
    ['half', 500, 1000, 500],
    ['rounded', 1, 3, 333],
    ['tiny but visible', 1, 100000, MIN_BAR],
    ['never above the scale', 2000, 1000, BAR_SCALE],
  ])('%s: %i of %i → %i', (_name, value, max, expected) => {
    expect(barHeight(value, max)).toBe(expected);
  });
});

describe('dailyBars', () => {
  const week = [
    point('2026-10-19', { current_revenue: 40000, previous_revenue: 80000 }),
    point('2026-10-20', {
      current_revenue: 20000,
      previous_revenue: 0,
      current_occupancy_bp: 5000,
      previous_occupancy_bp: 2500,
    }),
  ];

  it.each([
    [
      'revenue on the highest day of either year',
      'revenue',
      80000,
      [
        [500, 1000],
        [250, 0],
      ],
    ],
    [
      'occupancy always on 0–100%',
      'occupancy',
      10000,
      [
        [0, 0],
        [500, 250],
      ],
    ],
  ] as const)('%s', (_name, series, max, heights) => {
    const out = dailyBars(week, series);
    expect(out.max).toBe(max);
    expect(out.bars.map((b) => [b.currentHeight, b.previousHeight])).toEqual(heights);
    expect(out.bars.map((b) => b.date)).toEqual(['2026-10-19', '2026-10-20']);
  });

  it('draws nothing for a week without takings', () => {
    expect(dailyBars([point('2026-10-19')], 'revenue')).toEqual({
      max: 0,
      bars: [
        {
          key: '2026-10-19',
          date: '2026-10-19',
          current: 0,
          previous: 0,
          currentHeight: 0,
          previousHeight: 0,
        },
      ],
    });
  });
});
