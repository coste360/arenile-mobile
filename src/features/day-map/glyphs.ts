// Status glyphs of the day map, so that a status never depends on colour
// alone (spec 11.3: colour-blind users, greyscale screens, bright sun). Same
// glyph per status and same paths as the panel's badge glyphs
// (web/shared/src/map/kit/status.ts), on a 24-unit grid.
import type { SpotStatus } from './status';

export type StatusGlyph =
  'globe' | 'desk' | 'check' | 'star' | 'released' | 'clock' | 'cross' | 'euro' | 'renew' | 'lock';

/** Glyph per status; free spots have none (an empty spot reads as free). */
export const STATUS_GLYPHS: Readonly<Record<SpotStatus, StatusGlyph | null>> = {
  free: null,
  booked_online: 'globe',
  booked_desk: 'desk',
  season: 'star',
  season_released: 'released',
  hold: 'clock',
  to_collect: 'euro',
  present: 'check',
  blocked: 'cross',
  renewal_hold: 'renew',
  unavailable: 'lock',
};

/** Path data of each glyph on a 24-unit grid, drawn as a stroke (the star is filled). */
export const GLYPH_PATHS: Readonly<Record<StatusGlyph, string>> = {
  globe:
    'M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 1 0 0-15M4.5 12h15M12 4.5c-3 2.6-3 12.4 0 15M12 4.5c3 2.6 3 12.4 0 15',
  desk: 'M4.5 10.5h15M4.5 10.5l2.5-5h10l2.5 5M6 10.5V19h12v-8.5M9.5 15h5',
  check: 'M5.5 12.5l4.2 4.2L18.5 8',
  star: 'M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z',
  released: 'M7.5 16.5l9-9M9.5 7.5h7v7',
  clock: 'M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 1 0 0-15M12 8.5v4l2.8 1.8',
  cross: 'M7.5 7.5l9 9M16.5 7.5l-9 9',
  euro: 'M16.5 7.6a5.6 5.6 0 1 0 0 8.8M5.5 10.6h8M5.5 13.4h7',
  renew: 'M18.5 12a6.5 6.5 0 1 1-1.9-4.6M18.5 5v3.8h-3.8',
  lock: 'M7 11.5h10v7H7zM9.2 11.5V9a2.8 2.8 0 0 1 5.6 0v2.5',
};

/** Stroke width of a glyph on its 24-unit grid (the star is filled instead). */
export const glyphStrokeWidth = (g: StatusGlyph) => (g === 'star' ? 1 : 2.6);

/** Glyphs of the arrival and departure markers (an arrow into and out of a door), 24-unit grid. */
export const MARKER_PATHS: Readonly<Record<'arrival' | 'departure', string>> = {
  arrival: 'M4.5 12h10M11 8l4 4-4 4M19 5v14',
  departure: 'M9 12h10M15.5 8l4 4-4 4M5 5v14',
};
