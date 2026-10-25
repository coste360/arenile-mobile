// Colours of the Android widget, derived from the app theme (src/lib/theme.ts,
// itself kept equal to src/global.css): the Glance widget cannot read the
// NativeWind tokens and takes concrete colours, as hex for Compose.
import { THEME } from '@/lib/theme';

import type { WidgetColors } from './types';

const HSL = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/;

/** A theme colour in CSS HSL notation as upper-case hex (CSS Color 4 algorithm, rounded per channel). */
export function hslToHex(hsl: string): string {
  const m = HSL.exec(hsl);
  if (!m) throw new TypeError(`hslToHex: unsupported colour ${hsl}`);
  const h = Number(m[1]);
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function colorsOf(scheme: 'light' | 'dark'): WidgetColors {
  const t = THEME[scheme];
  return {
    background: hslToHex(t.card),
    foreground: hslToHex(t.foreground),
    accent: hslToHex(t.primary),
  };
}

export const WIDGET_COLORS: { light: WidgetColors; dark: WidgetColors } = {
  light: colorsOf('light'),
  dark: colorsOf('dark'),
};
