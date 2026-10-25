import { THEME } from '@/lib/theme';

import { hslToHex, WIDGET_COLORS } from './colors';

describe('hslToHex', () => {
  it.each([
    ['hsl(0 0% 100%)', '#FFFFFF'],
    ['hsl(0 0% 0%)', '#000000'],
    ['hsl(0 100% 50%)', '#FF0000'],
    ['hsl(120 100% 25%)', '#008000'],
    ['hsl(210 40% 98%)', '#F8FAFC'],
    ['hsl(222.2 47.4% 11.2%)', '#0F172A'],
  ])('%s → %s', (hsl, hex) => {
    expect(hslToHex(hsl)).toBe(hex);
  });

  it('rejects other notations', () => {
    expect(() => hslToHex('#fff')).toThrow(TypeError);
  });
});

describe('WIDGET_COLORS', () => {
  it.each(['light', 'dark'] as const)('follows the %s theme', (scheme) => {
    expect(WIDGET_COLORS[scheme]).toEqual({
      background: hslToHex(THEME[scheme].card),
      foreground: hslToHex(THEME[scheme].foreground),
      accent: hslToHex(THEME[scheme].primary),
    });
    for (const value of Object.values(WIDGET_COLORS[scheme])) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
