import { columnsFor, contentWidth, detailFitsBeside, navFitsBeside, navMode } from './panes';

describe('tablet panes', () => {
  it.each([
    // iPad 11" portrait: the expanded pane would leave 546 pt, so it is a drawer.
    [834, false],
    // iPad 13" portrait, 11" and 13" landscape.
    [1032, true],
    [1194, true],
    [1376, true],
  ])('navigation beside the content at %d pt: %s', (width, fits) => {
    expect(navFitsBeside(width)).toBe(fits);
  });

  it.each([
    [false, 834, 'rail'],
    [true, 834, 'drawer'],
    [true, 1194, 'beside'],
    [false, 1194, 'rail'],
  ] as const)('expanded %s at %d pt → %s', (expanded, width, mode) => {
    expect(navMode(expanded, width)).toBe(mode);
  });

  it.each([
    [834, 'rail', 770],
    [834, 'drawer', 770],
    [1194, 'beside', 906],
    [390, null, 390],
  ] as const)('content of a %d pt window with %s navigation: %d pt', (width, mode, content) => {
    expect(contentWidth(width, mode)).toBe(content);
  });

  it.each([
    // iPad 11" portrait with the rail: 770 − 320 = 450 pt of detail.
    [770, true],
    // Narrow Split View panes that are still tablets.
    [640, false],
    [906, true],
  ])('detail beside the list in %d pt of content: %s', (content, fits) => {
    expect(detailFitsBeside(content)).toBe(fits);
  });

  it.each([
    // Phone and narrow Split View: one card per row.
    [390, 2, 1],
    [584, 2, 1],
    // Two cards of 320 pt, the gap and both gutters.
    [688, 2, 2],
    // iPad 11" portrait with the rail, landscape with the pane beside.
    [770, 2, 2],
    [906, 3, 2],
    [1130, 3, 3],
    [1130, 2, 2],
  ])('cards side by side in %d pt of content (at most %d): %d', (content, max, columns) => {
    expect(columnsFor(content, max)).toBe(columns);
  });
});
