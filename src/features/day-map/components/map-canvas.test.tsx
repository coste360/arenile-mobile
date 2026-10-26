import { render, screen } from '@testing-library/react-native';

import type { BeachMap } from '@/api/types';
import { gridDocument } from '@/test/map-fixtures';

import { BACKDROP } from '../backdrop';
import {
  contentRect,
  fitCamera,
  MIN_LABEL_DP,
  quantiseScale,
  scaleLimits,
  seaDepth,
  zoomAt,
} from '../geometry';
import { buildDaySpots, type DaySpot } from '../model';
import { MAP_PALETTE } from '../palette';
import { MapBackdrop } from './map-backdrop';
import { MapCanvas, truncate } from './map-canvas';

const texts = { anonymous: 'Cliente anonimo', anonymousShort: 'Anonimo' };
const viewport = { width: 390, height: 460 };
// The SVG is hidden from screen readers (the list and the sheet carry the content).
const HIDDEN = { includeHiddenElements: true };

type JsonNode = {
  type: string;
  props: Record<string, unknown>;
  children: (JsonNode | string)[] | null;
};

/** Sprite symbols (their ids) and the symbol id every <Use> of the drawn SVG points to. */
function sprite(): { symbols: string[]; uses: string[] } {
  const out = { symbols: [] as string[], uses: [] as string[] };
  const walk = (n: JsonNode | JsonNode[] | string | null) => {
    if (!n || typeof n === 'string') return;
    if (Array.isArray(n)) return n.forEach(walk);
    const id = n.props.name ?? n.props.id;
    if (typeof id === 'string' && id.startsWith('kit-')) out.symbols.push(id);
    if (typeof n.props.href === 'string') out.uses.push(n.props.href.replace(/^#/, ''));
    n.children?.forEach(walk);
  };
  walk(screen.toJSON() as JsonNode | JsonNode[] | null);
  return out;
}

/** First host node (depth first) of the drawn SVG that satisfies `pred`. */
function findNode(
  root: JsonNode | (JsonNode | string)[] | string | null,
  pred: (n: JsonNode) => boolean,
): JsonNode | undefined {
  if (!root || typeof root === 'string') return undefined;
  if (Array.isArray(root)) {
    for (const n of root) {
      const hit = findNode(n, pred);
      if (hit) return hit;
    }
    return undefined;
  }
  if (pred(root)) return root;
  return findNode(root.children, pred);
}

/** Visible text of a host node (react-native-svg puts it in `content` of the TSpans). */
function textOf(n: JsonNode | string): string {
  if (typeof n === 'string') return n;
  const own = typeof n.props.content === 'string' ? n.props.content : '';
  return own + (n.children ?? []).map(textOf).join('');
}

const isWaves = (n: JsonNode) => n.type === 'RNSVGPattern' && /-waves$/.test(String(n.props.name));

/** The backdrop group (its Defs hold the waves pattern) and its shoreline frame group. */
function backdrop() {
  const root = findNode(
    screen.toJSON() as JsonNode | JsonNode[] | null,
    (n) =>
      n.type === 'RNSVGGroup' &&
      (n.children ?? []).some(
        (c) => typeof c !== 'string' && c.type === 'RNSVGDefs' && !!findNode(c, isWaves),
      ),
  );
  expect(root).toBeDefined();
  const frame = (root!.children ?? []).find(
    (c): c is JsonNode => typeof c !== 'string' && c.type === 'RNSVGGroup',
  );
  return { frame: frame!, waves: findNode(root!, isWaves)! };
}

function expectMatrix(actual: unknown, expected: number[]) {
  expect(Array.isArray(actual)).toBe(true);
  const m = actual as number[];
  expect(m).toHaveLength(6);
  expected.forEach((v, i) => expect(m[i]).toBeCloseTo(v, 9));
}

describe('MapCanvas', () => {
  // 30 × 20 = 600 umbrellas: a large lido.
  const document = gridDocument(30, 20);
  const spots = buildDaySpots({
    document,
    day: undefined,
    slot: 'FULL',
    canSeeCustomers: true,
    texts,
  });
  const fit = fitCamera(contentRect(document.map), viewport);

  async function draw(camera = fit, extra: Partial<Parameters<typeof MapCanvas>[0]> = {}) {
    await render(
      <MapCanvas
        document={document}
        spots={spots}
        camera={camera}
        viewport={viewport}
        overscan={0.25}
        palette={MAP_PALETTE.light}
        locale="it"
        seaLabel="Mare"
        {...extra}
      />,
    );
    return screen.queryAllByTestId(/^spot-/, HIDDEN);
  }

  it('draws every spot of the fitted map', async () => {
    expect(await draw()).toHaveLength(600);
  });

  it('draws only the spots around the viewport when zoomed in', async () => {
    const zoomed = zoomAt(fit, { x: 0, y: 0 }, 8, scaleLimits(fit));
    const drawn = await draw(zoomed);
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThan(60);
  });

  it('dims the spots that do not match the search', async () => {
    const first = spots[0]!.id;
    await draw(fit, { matches: new Set([first]) });
    expect(screen.getByTestId(`spot-${first}`, HIDDEN)).toHaveProp('opacity', 1);
    expect(screen.getByTestId(`spot-${spots[1]!.id}`, HIDDEN)).toHaveProp('opacity', 0.3);
  });

  it('draws every spot with the kit art, one symbol per illustration and status colour', async () => {
    await draw();
    const { symbols, uses } = sprite();
    expect(uses.length).toBeGreaterThanOrEqual(600);
    // The day is not known yet: every umbrella is drawn in the neutral colour, so once.
    const umbrellas = symbols.filter((id) => id.startsWith('kit-ombrellone_2_lettini-'));
    expect(umbrellas).toHaveLength(1);
    expect(uses.filter((href) => href === umbrellas[0])).toHaveLength(600);
  });

  it('draws the classic kit without recolouring the art', async () => {
    await draw(fit, { kit: 'classic' });
    expect(sprite().symbols).toContain('kit-ombrellone_2_lettini-_-_');
  });

  it('draws the sea label as the panel: semibold, letter-spaced, faded', async () => {
    await draw();
    // Host props of react-native-svg: the font attributes are grouped in `font`.
    const label = screen.getByTestId('day-map-sea-label', HIDDEN);
    const font = label.props.font as {
      fontSize: number;
      fontWeight: string;
      letterSpacing: number;
    };
    expect(label.props.opacity).toBe(0.55);
    expect(font.fontWeight).toBe('600');
    expect(font.letterSpacing).toBeCloseTo(font.fontSize * 0.12);
  });

  it('textures sand and sea with patterns, not per-spot elements', async () => {
    await draw();
    const brushes: string[] = [];
    const walk = (n: JsonNode | JsonNode[] | string | null) => {
      if (!n || typeof n === 'string') return;
      if (Array.isArray(n)) return n.forEach(walk);
      const fill = n.props.fill as { brushRef?: string } | undefined;
      if (fill?.brushRef) brushes.push(fill.brushRef);
      n.children?.forEach(walk);
    };
    walk(screen.toJSON() as JsonNode | JsonNode[] | null);
    // Grain on the sand, waves on the sea: two rects for 600 spots.
    expect(brushes).toEqual([expect.stringMatching(/-grain$/), expect.stringMatching(/-waves$/)]);
  });

  it('truncates captions to the room they have', () => {
    expect(truncate('Bianchi', 100, 10)).toBe('Bianchi');
    expect(truncate('Bianchi-Visconti', 40, 10)).toBe('Bianch…');
  });

  describe('sea backdrop per sea side', () => {
    // 3 × 4 umbrellas: a map of 280 × 220, sea depth 26 (seaDepth: 12% of 220, rounded).
    const small = gridDocument(3, 4);
    const W = small.map.width;
    const H = small.map.height;
    const smallSpots = buildDaySpots({
      document: small,
      day: undefined,
      slot: 'FULL',
      canSeeCustomers: true,
      texts,
    });

    // frame: matrix of shoreFrame(side).transform; label: centre of the sea band (seaRect).
    it.each<{
      side: BeachMap['sea_side'];
      frame: number[];
      waves: number[];
      label: number[] | undefined;
    }>([
      {
        side: 'top',
        // translate(280 0) rotate(180)
        frame: [-1, 0, 0, -1, W, 0],
        waves: [0.7, 0, 0, 0.7, 0, 0],
        label: undefined,
      },
      {
        side: 'bottom',
        // translate(0 220)
        frame: [1, 0, 0, 1, 0, H],
        waves: [0.7, 0, 0, 0.7, 0, 0],
        label: undefined,
      },
      {
        side: 'left',
        // rotate(90); waves rotate(90) scale(0.7); label rotate(-90 -13 110)
        frame: [0, 1, -1, 0, 0, 0],
        waves: [0, 0.7, -0.7, 0, 0, 0],
        label: [0, -1, 1, 0, -13 - 110, 110 + -13],
      },
      {
        side: 'right',
        // translate(280 220) rotate(-90); waves rotate(90) scale(0.7); label rotate(-90 293 110)
        frame: [0, -1, 1, 0, W, H],
        waves: [0, 0.7, -0.7, 0, 0, 0],
        label: [0, -1, 1, 0, 293 - 110, 110 + 293],
      },
    ])('sea on the $side: shoreline frame, waves and label orientation', async (c) => {
      const document = { ...small, map: { ...small.map, sea_side: c.side } };
      await render(
        <MapCanvas
          document={document}
          spots={smallSpots}
          camera={fitCamera(contentRect(document.map), viewport)}
          viewport={viewport}
          overscan={0.25}
          palette={MAP_PALETTE.light}
          locale="it"
          seaLabel="Mare"
        />,
      );
      const { frame, waves } = backdrop();
      expectMatrix(frame.props.matrix, c.frame);
      expectMatrix(waves.props.patternTransform, c.waves);
      const label = screen.getByTestId('day-map-sea-label', HIDDEN);
      expect(textOf(screen.toJSON() as JsonNode)).toContain('Mare');
      if (c.label) expectMatrix(label.props.matrix, c.label);
      else expect(label.props.matrix).toBeUndefined();
    });
  });

  describe('sea label size threshold', () => {
    // Font of the label: BACKDROP.labelSize of the sea depth, in map units.
    const font = seaDepth(document.map) * BACKDROP.labelSize;
    // Quarter powers of two around the threshold: MapCanvas quantises the camera scale.
    const step = Math.floor(Math.log2(MIN_LABEL_DP / font) * 4);
    const below = 2 ** (step / 4);
    const above = 2 ** ((step + 1) / 4);

    it.each([
      { name: 'quantised scale just below the threshold', k: below, shown: false },
      { name: 'quantised scale just above the threshold', k: above, shown: true },
    ])('through the canvas camera, $name', async ({ k, shown }) => {
      expect(quantiseScale(k)).toBeCloseTo(k, 9);
      expect(font * k < MIN_LABEL_DP).toBe(!shown);
      await draw({ k, tx: 0, ty: 0 });
      if (shown) expect(screen.getByTestId('day-map-sea-label', HIDDEN)).toBeTruthy();
      else expect(screen.queryByTestId('day-map-sea-label', HIDDEN)).toBeNull();
    });

    it.each([
      {
        name: 'just below MIN_LABEL_DP on screen',
        k: (MIN_LABEL_DP / font) * 0.999,
        label: 'Mare',
        shown: false,
      },
      {
        name: 'just above MIN_LABEL_DP on screen',
        k: (MIN_LABEL_DP / font) * 1.001,
        label: 'Mare',
        shown: true,
      },
      { name: 'empty sea label at a readable size', k: 1, label: '', shown: false },
    ])('backdrop alone, $name', async ({ k, label, shown }) => {
      await render(
        <MapBackdrop map={document.map} palette={MAP_PALETTE.light} seaLabel={label} k={k} />,
      );
      if (shown) expect(screen.getByTestId('day-map-sea-label', HIDDEN)).toBeTruthy();
      else expect(screen.queryByTestId('day-map-sea-label', HIDDEN)).toBeNull();
    });
  });

  describe('spot code label', () => {
    it.each<{ status: DaySpot['status']; opacity: number }>([
      { status: 'unavailable', opacity: 0.6 },
      { status: 'free', opacity: 1 },
      { status: 'booked_desk', opacity: 1 },
      { status: null, opacity: 1 },
    ])('$status spot: label pill opacity $opacity', async ({ status, opacity }) => {
      const spot = { ...spots[0]!, status };
      // Zoomed on the first umbrella: at the fitted scale of 600 spots codes are too small to draw.
      await draw(zoomAt(fit, { x: 0, y: 0 }, 8, scaleLimits(fit)), { spots: [spot] });
      const node = screen.getByTestId(`spot-${spot.id}`, HIDDEN);
      // Spot nodes are host groups: look up the pill (rect + text) holding the spot code.
      const json = findNode(
        screen.toJSON() as JsonNode | JsonNode[] | null,
        (n) => n.props.testID === `spot-${spot.id}`,
      );
      expect(node).toBeTruthy();
      const pill = findNode(
        json!,
        (n) =>
          n.type === 'RNSVGGroup' &&
          (n.children ?? []).some((c) => typeof c !== 'string' && c.type === 'RNSVGRect') &&
          (n.children ?? []).some(
            (c) => typeof c !== 'string' && c.type === 'RNSVGText' && textOf(c) === spot.label,
          ),
      );
      expect(pill).toBeDefined();
      expect(pill!.props.opacity ?? 1).toBe(opacity);
    });
  });
});
