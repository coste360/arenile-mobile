import { figureRows, figuresPerRow } from './figure-rows';

describe('figuresPerRow', () => {
  it.each([
    [0, 1],
    [149, 1],
    [312, 2],
    [358, 2],
    [474, 3],
    [608, 3],
    [636, 4],
    [798, 5],
  ])('%i pt → %i', (width, expected) => {
    expect(figuresPerRow(width)).toBe(expected);
  });
});

describe('figureRows', () => {
  it.each([
    ['iPhone (358 pt)', 5, 358, [1, 2, 2]],
    ['tablet column (608 pt)', 5, 608, [1, 2, 2]],
    ['four fit', 5, 650, [1, 4]],
    ['all fit', 5, 900, [5]],
    ['narrow', 5, 140, [1, 1, 1, 1, 1]],
    ['four cards on a phone', 4, 358, [2, 2]],
    ['six cards, room for four', 6, 650, [3, 3]],
    ['no cards', 0, 900, []],
  ])('%s: %i cards in %i pt → %j', (_name, count, width, rows) => {
    expect(figureRows(count, width)).toEqual(rows);
  });
});
