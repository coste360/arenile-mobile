import { centsToInput, formatCents, isCents, parseCents } from './money';

// Intl separates amount and symbol with a (narrow) no-break space.
const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatCents', () => {
  it.each([
    [0, '0,00 €'],
    [5, '0,05 €'],
    [1250, '12,50 €'],
    // Italian groups thousands only from five digits (CLDR minimum grouping).
    [100000, '1000,00 €'],
    [1000000, '10.000,00 €'],
    [-1250, '-12,50 €'],
    [123456789, '1.234.567,89 €'],
  ])('%d cents → %s in Italian', (cents, expected) => {
    expect(plain(formatCents(cents))).toBe(expected);
  });

  it('formats in another locale when asked', () => {
    expect(plain(formatCents(1250, { locale: 'en-GB' }))).toBe('€12.50');
  });

  it.each([12.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %p', (v) => {
    expect(() => formatCents(v)).toThrow(TypeError);
  });
});

describe('parseCents', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.50', 1250],
    ['0,05', 5],
    ['€ 12,50', 1250],
    [' 7 ', 700],
    // Exact without floats: 0.29 * 100 would be 28.999999999999996.
    ['0,29', 29],
    ['1,005', null],
    ['1.250,00', null],
    ['-5', null],
    ['', null],
    ['abc', null],
  ])('%p → %p', (input, expected) => {
    expect(parseCents(input)).toBe(expected);
  });
});

describe('isCents', () => {
  it.each([
    [0, true],
    [1250, true],
    [12.5, false],
    ['1250', false],
  ])('%p → %p', (v, expected) => {
    expect(isCents(v)).toBe(expected);
  });
});

describe('centsToInput', () => {
  it.each([
    [2000, '20,00'],
    [1250, '12,50'],
    [5, '0,05'],
    [0, '0,00'],
    [123456789, '1234567,89'],
  ])('%p → %p and back', (cents, text) => {
    expect(centsToInput(cents)).toBe(text);
    expect(parseCents(text)).toBe(cents);
  });

  it.each([12.5, -1])('rejects %p', (v) => {
    expect(() => centsToInput(v)).toThrow(TypeError);
  });
});
