import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MAP_PALETTE, type MapPalette } from './palette';
import { SPOT_STATUSES } from './status';

const css = readFileSync(join(__dirname, '..', '..', 'global.css'), 'utf8');

function variables(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*([^;]+);/g)) out[m[1] ?? ''] = (m[2] ?? '').trim();
  return out;
}

const light = variables(css.slice(css.indexOf(':root {'), css.indexOf('.dark:root')));
const dark = variables(css.slice(css.indexOf('.dark:root')));

/** Every palette colour with the CSS variable it mirrors. */
function pairs(p: MapPalette): [string, string][] {
  const out: [string, string][] = [];
  for (const s of SPOT_STATUSES) {
    const v = `status-${s.replace(/_/g, '-')}`;
    out.push([v, p.status[s].fill], [`${v}-foreground`, p.status[s].foreground]);
  }
  out.push(
    ['map-sand', p.sand],
    ['map-sea', p.sea],
    ['map-sea-label', p.seaLabel],
    ['map-decoration', p.decoration],
    ['map-decoration-stroke', p.decorationStroke],
    ['map-decoration-label', p.decorationLabel],
    ['map-spot-stroke', p.spotStroke],
    ['map-spot-selected', p.spotSelected],
    ['status-unavailable', p.unknown],
  );
  return out;
}

describe('day map palette', () => {
  it.each([
    ['light', MAP_PALETTE.light, light],
    ['dark', MAP_PALETTE.dark, dark],
  ] as const)('%s colours equal the CSS variables of src/global.css', (_name, palette, vars) => {
    for (const [token, value] of pairs(palette)) {
      expect({ token, value }).toEqual({ token, value: `hsl(${vars[token]})` });
    }
  });
});
