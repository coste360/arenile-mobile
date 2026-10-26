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
  /** "Mare" label of the sea band; sand and sea are the --beach-* tokens (backdrop.ts, as the panel). */
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
  /** Pill behind spot codes and captions, its text, and the blocked bar (theme background/foreground). */
  labelBackground: string;
  labelForeground: string;
  /** Colours of the kit illustrations (`var(--beach-<token>)` of the art; ADR 0013). */
  beach: Readonly<Record<BeachToken, string>>;
  /** Sea flag colours a decoration `variant` picks (bandiera_mare). */
  flags: Readonly<Record<'green' | 'yellow' | 'red', string>>;
}

/** The --beach-* tokens the kit art reads (`flag` and `state` are set per element). */
export type BeachToken =
  | 'ink'
  | 'muted'
  | 'frame'
  | 'canvas'
  | 'sand'
  | 'sand-soft'
  | 'navy'
  | 'navy-soft'
  | 'sage'
  | 'sage-soft'
  | 'clay'
  | 'clay-soft'
  | 'wood'
  | 'wood-soft'
  | 'water'
  | 'water-soft';

const INK = 'hsl(220.9 39.3% 11%)';

// Kit tokens: the values of the panel's web/shared/src/styles/globals.css in
// the pinned core (v1.0.1), which override the kits' own beach-tokens.css.
const BEACH_LIGHT = {
  ink: '#263746',
  muted: '#94a3b8',
  frame: '#dce4e8',
  canvas: '#ffffff',
  sand: '#f5ecdd',
  'sand-soft': '#fbf7f0',
  navy: '#365b78',
  'navy-soft': '#dbe9f1',
  sage: '#779c87',
  'sage-soft': '#deece2',
  clay: '#c77c69',
  'clay-soft': '#f6e6df',
  wood: '#ba9472',
  'wood-soft': '#ebdbc7',
  water: '#a9d7e4',
  'water-soft': '#e3f4f7',
} as const;
const BEACH_DARK = {
  ink: '#b8c9d6',
  muted: '#8396a6',
  frame: '#465765',
  canvas: '#243442',
  sand: '#695e50',
  'sand-soft': '#3a3833',
  navy: '#b1cbdf',
  'navy-soft': '#415b70',
  sage: '#a3c3ad',
  'sage-soft': '#3b5d4c',
  clay: '#d9a493',
  'clay-soft': '#664f4c',
  wood: '#cfb396',
  'wood-soft': '#615443',
  water: '#74afc4',
  'water-soft': '#2c4553',
} as const;
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
    seaLabel: 'hsl(202 80.3% 23.9%)',
    decoration: 'hsl(42.2 43.5% 83.3%)',
    decorationStroke: 'hsl(40.4 25.9% 62.9%)',
    decorationLabel: 'hsl(39.2 36.8% 26.1%)',
    spotStroke: INK,
    spotSelected: INK,
    unknown: 'hsl(216 12.2% 83.9%)',
    labelBackground: 'hsl(210 40% 98%)',
    labelForeground: 'hsl(222.2 47.4% 11.2%)',
    beach: BEACH_LIGHT,
    flags: { green: '#3f9c5f', yellow: '#e5b20b', red: '#d6453d' },
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
    seaLabel: 'hsl(200 72.4% 88.6%)',
    decoration: 'hsl(40 19.4% 24.3%)',
    decorationStroke: 'hsl(41.1 22.1% 52.2%)',
    decorationLabel: 'hsl(42.4 56.2% 85.7%)',
    spotStroke: WHITE,
    spotSelected: WHITE,
    unknown: 'hsl(240 5.2% 33.9%)',
    labelBackground: 'hsl(211.6 73.1% 10.2%)',
    labelForeground: 'hsl(210 40% 98%)',
    beach: BEACH_DARK,
    flags: { green: '#5cbf7d', yellow: '#f2c94c', red: '#ef6b62' },
  },
};
