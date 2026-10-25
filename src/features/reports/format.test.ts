import type { ComparisonMetric } from '@/api/types';

import {
  deltaTone,
  deltaTrend,
  formatCount,
  formatDelta,
  formatMetricValue,
  formatRatioBP,
  formatSignedBP,
  metricsByKey,
} from './format';

const metric = (overrides: Partial<ComparisonMetric> = {}): ComparisonMetric => ({
  metric: 'revenue_collected',
  unit: 'cents',
  current: 125000,
  previous: 100000,
  delta: 25000,
  delta_bp: 2500,
  ...overrides,
});

const LABELS = { points: 'p.p.', new: 'nuovo' };
// Intl separates the percent sign with a no-break space in some languages.
const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatSignedBP (truncated like the server)', () => {
  it.each([
    [1250, 'it', '+12,5%'],
    [1250, 'en', '+12.5%'],
    [1250, 'de', '+12,5 %'],
    [-33, 'it', '−0,3%'],
    [-39, 'it', '−0,3%'],
    [0, 'it', '0,0%'],
    [10000, 'it', '+100,0%'],
  ])('%i in %s → %s', (bp, locale, expected) => {
    expect(plain(formatSignedBP(bp, locale))).toBe(expected);
  });
});

describe('formatRatioBP', () => {
  it.each([
    [6234, 'it', '62,3%'],
    [0, 'en', '0.0%'],
    [10000, 'en', '100.0%'],
  ])('%i in %s → %s', (bp, locale, expected) => {
    expect(plain(formatRatioBP(bp, locale))).toBe(expected);
  });
});

describe('formatMetricValue', () => {
  it.each([
    ['cents', 125050, 'it', '1250,50 €'],
    ['cents', 125050, 'en', '€1,250.50'],
    ['count', 12345, 'it', '12.345'],
    ['count', 12345, 'en', '12,345'],
    ['basis_points', 6234, 'it', '62,3%'],
  ] as const)('%s %i in %s → %s', (unit, value, locale, expected) => {
    // Italian groups thousands only from five digits in Intl ("1250,50").
    expect(plain(formatMetricValue({ unit }, value, locale))).toBe(expected);
  });
});

describe('formatDelta', () => {
  it.each([
    ['relative change', metric(), '+25,0%'],
    ['percentage points for occupancy', metric({ unit: 'basis_points', delta: 450 }), '+4,5 p.p.'],
    [
      'new when the previous year was zero',
      metric({ previous: 0, delta: 125000, delta_bp: undefined }),
      'nuovo',
    ],
    [
      'no change from zero to zero',
      metric({ current: 0, previous: 0, delta: 0, delta_bp: undefined }),
      '0,0%',
    ],
  ])('%s', (_name, m, expected) => {
    expect(plain(formatDelta(m, 'it', LABELS))).toBe(expected);
  });
});

describe('deltaTrend and deltaTone', () => {
  it.each([
    [metric({ delta: 10 }), 'up', 'positive'],
    [metric({ delta: -10 }), 'down', 'negative'],
    [metric({ delta: 0 }), 'flat', 'neutral'],
    [metric({ metric: 'cancellations', unit: 'count', delta: 3 }), 'up', 'negative'],
    [metric({ metric: 'no_shows', unit: 'count', delta: -1 }), 'down', 'positive'],
  ] as const)('%j → %s, %s', (m, trend, tone) => {
    expect(deltaTrend(m)).toBe(trend);
    expect(deltaTone(m)).toBe(tone);
  });
});

describe('metricsByKey', () => {
  it('indexes the metrics and tolerates a missing report', () => {
    const m = metric();
    expect(metricsByKey([m]).revenue_collected).toBe(m);
    expect(metricsByKey(undefined)).toEqual({});
  });
});

describe('formatCount', () => {
  it('rounds nothing: counts are integers', () => {
    expect(formatCount(7, 'it')).toBe('7');
  });
});
