import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { THEME } from './theme';

const css = readFileSync(join(__dirname, '..', 'global.css'), 'utf8');

function variables(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*([^;]+);/g)) out[m[1] ?? ''] = (m[2] ?? '').trim();
  return out;
}

const light = variables(css.slice(css.indexOf(':root {'), css.indexOf('.dark:root')));
const dark = variables(css.slice(css.indexOf('.dark:root')));

describe('navigation theme', () => {
  it.each([
    ['light', THEME.light, light],
    ['dark', THEME.dark, dark],
  ] as const)('%s colours equal the CSS variables of src/global.css', (_name, theme, vars) => {
    for (const [token, value] of Object.entries(theme)) {
      expect({ token, value }).toEqual({ token, value: `hsl(${vars[token]})` });
    }
  });

  it('defines every token in both schemes', () => {
    expect(Object.keys(dark).sort()).toEqual(
      Object.keys(light)
        .filter((k) => k !== 'radius')
        .sort(),
    );
  });
});
