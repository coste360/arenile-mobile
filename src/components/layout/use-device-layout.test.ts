import { layoutFor } from './use-device-layout';

describe('layoutFor', () => {
  it.each([
    ['iPhone portrait', 390, 844, 'phone'],
    ['iPhone landscape', 844, 390, 'phone'],
    ['large Android phone', 412, 915, 'phone'],
    ['iPad mini portrait', 744, 1133, 'tablet'],
    ['iPad Pro landscape', 1366, 1024, 'tablet'],
    ['7-inch Android tablet', 600, 960, 'tablet'],
    ['iPad Slide Over', 320, 1024, 'phone'],
  ] as const)('%s (%ix%i) -> %s', (_name, w, h, expected) => {
    expect(layoutFor(w, h)).toBe(expected);
  });
});
