import { sheetBesideMap } from './layout';

describe('sheetBesideMap', () => {
  it.each([
    // iPad 11" portrait, rail: 386 pt of map would be left.
    [true, 770, false],
    // iPad 13" portrait, expanded pane.
    [true, 744, false],
    // iPad 11" landscape, expanded pane.
    [true, 906, true],
    // iPad 11" landscape, rail.
    [true, 1130, true],
    // Phones always open the sheet under the map.
    [false, 1366, false],
  ])('tablet %s, %d pt of content → beside %s', (tablet, content, beside) => {
    expect(sheetBesideMap(tablet, content)).toBe(beside);
  });
});
