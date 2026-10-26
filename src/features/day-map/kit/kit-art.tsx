// Kit illustrations for react-native-svg (ADR 0013): each (asset, status
// colour, flag colour) the map needs becomes ONE <Symbol> in <Defs>, and every
// spot or decoration is a <Use> of it, so a map of 500 umbrellas holds the
// umbrella drawing once. react-native-svg cannot read CSS variables: the
// `$<token>` colours of the generated art are resolved here from the palette
// of the theme, `$state` to the status colour and `$flag` to the flag colour.
import { createElement, memo, type ComponentType, type ReactElement } from 'react';
import {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
  Symbol as SvgSymbol,
  Text as SvgText,
} from 'react-native-svg';

import type { BeachToken, MapPalette } from '../palette';
import type { KitArt, KitNode } from './art-types';
import type { KitAssetId } from './kits';

const ELEMENTS: Record<string, ComponentType<Record<string, unknown>>> = {
  g: G,
  path: Path,
  rect: Rect,
  circle: Circle,
  ellipse: Ellipse,
  line: Line,
  polyline: Polyline,
  polygon: Polygon,
  text: SvgText,
} as Record<string, ComponentType<Record<string, unknown>>>;

/** One symbol of the sprite: an asset drawn with a status and a flag colour. */
export interface KitSymbolRequest {
  asset: KitAssetId;
  /** Colour of the art's status part (`$state`); the free colour when absent. */
  state?: string;
  /** Colour of a sea flag (`$flag`). */
  flag?: string;
}

/** Stable id of a symbol request (its colours included, so a theme change redraws it). */
export function kitSymbolId({ asset, state, flag }: KitSymbolRequest): string {
  const tail = [state, flag].map((c) => (c ? c.replace(/[^a-zA-Z0-9]/g, '') : '_')).join('-');
  return `kit-${asset}-${tail}`;
}

interface Colours {
  palette: MapPalette;
  state: string;
  flag: string;
}

function colour(value: string, c: Colours): string {
  if (value === 'none' || !value.startsWith('$')) return value;
  const token = value.slice(1);
  if (token === 'state') return c.state;
  if (token === 'flag') return c.flag;
  return c.palette.beach[token as BeachToken] ?? c.palette.beach.ink;
}

function renderNodes(nodes: readonly KitNode[], c: Colours, prefix: string): ReactElement[] {
  return nodes.map(([tag, props, children], i) => {
    const key = `${prefix}.${i}`;
    const p: Record<string, unknown> = { ...props };
    if (typeof props.fill === 'string') p.fill = colour(props.fill, c);
    if (typeof props.stroke === 'string') p.stroke = colour(props.stroke, c);
    if (typeof children === 'string') p.children = children;
    else if (children.length > 0) p.children = renderNodes(children, c, key);
    return createElement(ELEMENTS[tag]!, { key, ...p });
  });
}

export interface KitDefsProps {
  art: KitArt;
  symbols: readonly KitSymbolRequest[];
  palette: MapPalette;
}

/** The <Defs> sprite with one <Symbol> per request (viewBox 0 0 120 120). */
export const KitDefs = memo(function KitDefs({ art, symbols, palette }: KitDefsProps) {
  return (
    <Defs>
      {symbols.map((s) => {
        const id = kitSymbolId(s);
        const nodes = art[s.asset];
        if (!nodes) return null;
        return (
          <SvgSymbol key={id} id={id} viewBox="0 0 120 120">
            {renderNodes(
              nodes,
              {
                palette,
                state: s.state ?? palette.status.free.fill,
                flag: s.flag ?? palette.flags.green,
              },
              id,
            )}
          </SvgSymbol>
        );
      })}
    </Defs>
  );
});
