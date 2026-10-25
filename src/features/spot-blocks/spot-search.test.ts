import { spot } from '@/test/operations-fixtures';

import { matchSpots, SPOT_RESULTS_MAX } from './spot-search';

const labels = (r: ReturnType<typeof matchSpots>) => r.spots.map((s) => s.label);

describe('matchSpots', () => {
  const spots = ['A10', 'A2', 'B1', 'BA3', 'A1'].map((label, i) =>
    spot({ spot_id: `s-${i}`, label }),
  );

  it.each([
    ['', ['A1', 'A2', 'A10', 'B1', 'BA3']],
    ['a', ['A1', 'A2', 'A10', 'BA3']],
    ['a1', ['A1', 'A10']],
    ['b', ['B1', 'BA3']],
    ['z', []],
  ])('%j → %j', (query, want) => {
    expect(labels(matchSpots(spots, query))).toEqual(want);
  });

  it('leaves inactive spots out', () => {
    expect(labels(matchSpots([spot({ status: 'inactive' })], ''))).toEqual([]);
  });

  it('caps the rows and says there are more', () => {
    const many = Array.from({ length: SPOT_RESULTS_MAX + 1 }, (_, i) =>
      spot({ spot_id: `s-${i}`, label: `C${i}` }),
    );
    const r = matchSpots(many, 'c');
    expect(r.spots).toHaveLength(SPOT_RESULTS_MAX);
    expect(r.more).toBe(true);
  });
});
