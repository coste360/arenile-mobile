// Concrete colours of the day map, for react-native-svg (ADR 0008). The map
// draws hundreds of shapes: passing `fill`/`stroke` props is far cheaper than
// resolving a NativeWind class on every SVG element, and SVG props cannot read
// the CSS variables. Same values as the --status-* and --map-* tokens of
// src/global.css (from the core panel), HSL triplets verbatim;
// palette.test.ts fails when they drift. One of the two files allowed raw
// colours (scripts/style-guard.js).
import type { SpotStatus } from './status';

export interface StatusColours {
  /** Fill of the spot and of the badge. */
  fill: string;
  /** Glyphs and labels drawn on the fill. */
  foreground: string;
}

export interface MapPalette {
  status: Readonly<Record<SpotStatus, StatusColours>>;
  sand: string;
  sea: string;
  seaLabel: string;
  decoration: string;
  decorationStroke: string;
  decorationLabel: string;
  /** Outline of every spot, drawn at SPOT_STROKE_OPACITY. */
  spotStroke: string;
  /** Ring of the selected spot and of the search matches. */
  spotSelected: string;
  /** Fill of a spot whose status is not known yet (day still loading). */
  unknown: string;
}

/** Opacity of the spot outline (the panel's rgb(… / 0.35)). */
export const SPOT_STROKE_OPACITY = 0.35;

const INK = 'hsl(220.9 39.3% 11%)';
const WHITE = 'hsl(0 0% 100%)';

export const MAP_PALETTE: Readonly<Record<'light' | 'dark', MapPalette>> = {
  light: {
    status: {
      free: { fill: 'hsl(240 3.8% 46.1%)', foreground: WHITE },
      booked_online: { fill: 'hsl(200.4 98% 39.4%)', foreground: 'hsl(0 0% 0%)' },
      booked_desk: { fill: 'hsl(262.1 83.3% 57.8%)', foreground: WHITE },
      season: { fill: 'hsl(175.3 77.4% 26.1%)', foreground: WHITE },
      season_released: { fill: 'hsl(170.6 76.9% 64.3%)', foreground: INK },
      hold: { fill: 'hsl(26 90.5% 37.1%)', foreground: WHITE },
      to_collect: { fill: 'hsl(0 72.2% 50.6%)', foreground: WHITE },
      present: { fill: 'hsl(224.4 64.3% 32.9%)', foreground: WHITE },
      blocked: { fill: 'hsl(216.9 19.1% 26.7%)', foreground: WHITE },
      renewal_hold: { fill: 'hsl(333.3 71.4% 50.6%)', foreground: WHITE },
      unavailable: { fill: 'hsl(216 12.2% 83.9%)', foreground: INK },
    },
    sand: 'hsl(42.2 72.5% 90%)',
    sea: 'hsl(200 70.1% 69.8%)',
    seaLabel: 'hsl(202 80.3% 23.9%)',
    decoration: 'hsl(42.2 43.5% 83.3%)',
    decorationStroke: 'hsl(40.4 25.9% 62.9%)',
    decorationLabel: 'hsl(39.2 36.8% 26.1%)',
    spotStroke: INK,
    spotSelected: INK,
    unknown: 'hsl(216 12.2% 83.9%)',
  },
  dark: {
    status: {
      free: { fill: 'hsl(240 4.9% 83.9%)', foreground: INK },
      booked_online: { fill: 'hsl(200.6 94.4% 86.1%)', foreground: INK },
      booked_desk: { fill: 'hsl(255.1 91.7% 76.3%)', foreground: INK },
      season: { fill: 'hsl(173.4 80.4% 40%)', foreground: INK },
      season_released: { fill: 'hsl(170.6 76.9% 64.3%)', foreground: INK },
      hold: { fill: 'hsl(37.7 92.1% 50.2%)', foreground: INK },
      to_collect: { fill: 'hsl(0 90.6% 70.8%)', foreground: INK },
      present: { fill: 'hsl(234.5 89.5% 73.9%)', foreground: INK },
      blocked: { fill: 'hsl(240 3.7% 57.3%)', foreground: INK },
      renewal_hold: { fill: 'hsl(328.6 85.5% 70.2%)', foreground: INK },
      unavailable: { fill: 'hsl(240 5.2% 33.9%)', foreground: WHITE },
    },
    sand: 'hsl(40 18.4% 19.2%)',
    sea: 'hsl(203 58.3% 27.3%)',
    seaLabel: 'hsl(200 72.4% 88.6%)',
    decoration: 'hsl(40 19.4% 24.3%)',
    decorationStroke: 'hsl(41.1 22.1% 52.2%)',
    decorationLabel: 'hsl(42.4 56.2% 85.7%)',
    spotStroke: WHITE,
    spotSelected: WHITE,
    unknown: 'hsl(240 5.2% 33.9%)',
  },
};
