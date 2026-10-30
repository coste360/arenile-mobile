#!/usr/bin/env node
// Beach map kits of the PINNED Arenile core release (ADR 0013), run by make:
//
//   make gen        download assets/map-kits/<kit>/ of the core release in
//                   api/core-version.json when the vendored copy is missing or
//                   of another release, record its SHA-256 in
//                   assets/map-kits/kits.lock.json, then write
//                   src/features/day-map/kit/generated/
//   make gen-check  same, offline: the vendored files must match the lock
//
// The kit files (manifest.json, NOTICE.md, svg/*.svg, © Coste360, BSL 1.1)
// are vendored verbatim, like api/openapi.yaml. The SVGs are converted into
// element trees for react-native-svg, which cannot read CSS variables: every
// colour must be `none` or `var(--beach-<token>, fallback)` and becomes the
// token name, resolved per theme by the app palette (`--beach-state` is the
// status colour). Anything outside a small allowlist of elements and
// attributes fails the generation, naming the file and the rule.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PIN_FILE = join(ROOT, 'api', 'core-version.json');
const KITS_DIR = join(ROOT, 'assets', 'map-kits');
const LOCK_FILE = join(KITS_DIR, 'kits.lock.json');
const OUT_DIR = join(ROOT, 'src', 'features', 'day-map', 'kit', 'generated');
const RAW_URL = (version, path) =>
  `https://raw.githubusercontent.com/coste360/arenile/${version}/assets/map-kits/${path}`;

/**
 * Kits of the core, default first, with how the status is drawn: `fill` the
 * art paints its status part with --beach-state; `halo` a tinted disc under
 * the art, never recoloured (core ADR 0012, 0024).
 */
const KITS = [
  { key: 'modern', style: 'fill' },
  { key: 'classic', style: 'halo' },
];
const VIEWBOX = '0 0 120 120';
/** Same normalisation as the core generator: classic draws this one as a diamond. */
const NORMALISE = { classic: { ombrellone_quadrato: 'translate(9 9) rotate(-45 51 51)' } };
/** Modular walkway tiles (core: TILE_RE). */
const TILE_RE = /^passerella_/;

const ELEMENTS = new Set([
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
]);
/** SVG attribute → react-native-svg prop. */
const PROPS = {
  fill: 'fill',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  stroke: 'stroke',
  'stroke-width': 'strokeWidth',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-linecap': 'strokeLinecap',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-opacity': 'strokeOpacity',
  opacity: 'opacity',
  transform: 'transform',
  d: 'd',
  x: 'x',
  y: 'y',
  x1: 'x1',
  y1: 'y1',
  x2: 'x2',
  y2: 'y2',
  cx: 'cx',
  cy: 'cy',
  r: 'r',
  rx: 'rx',
  ry: 'ry',
  width: 'width',
  height: 'height',
  points: 'points',
  'font-family': 'fontFamily',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'text-anchor': 'textAnchor',
};
const NUMERIC = new Set([
  'fillOpacity',
  'strokeWidth',
  'strokeOpacity',
  'opacity',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'width',
  'height',
  'fontSize',
]);
const NUMBER_RE = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
const HEX = '#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?';
/** var(--beach-x, #hex) or var(--beach-x, var(--beach-y, #hex)): the outer token wins. */
const COLOUR_RE = new RegExp(
  `^var\\(--beach-([a-z-]+),\\s*(?:${HEX}|var\\(--beach-[a-z-]+,\\s*${HEX}\\))\\)$`,
);

const args = process.argv.slice(2);
const offline = args.includes('--offline');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
class KitError extends Error {}
const fail = (msg) => {
  throw new KitError(msg);
};

async function download(version, path) {
  const res = await fetch(RAW_URL(version, path), { redirect: 'follow' });
  if (!res.ok) fail(`download failed: HTTP ${res.status} for ${RAW_URL(version, path)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Files of a vendored kit, relative to its directory, sorted. */
function kitFiles(key) {
  const dir = join(KITS_DIR, key);
  if (!existsSync(join(dir, 'manifest.json'))) return null;
  const svgs = existsSync(join(dir, 'svg'))
    ? readdirSync(join(dir, 'svg')).map((f) => `svg/${f}`)
    : [];
  return ['NOTICE.md', 'manifest.json', ...svgs].sort();
}

/** One hash over the names and contents of the files of a kit. */
function kitHash(key) {
  const files = kitFiles(key);
  if (!files) return null;
  const h = createHash('sha256');
  for (const f of files) {
    const p = join(KITS_DIR, key, f);
    if (!existsSync(p)) return null;
    h.update(`${f}\0${sha256(readFileSync(p))}\n`);
  }
  return h.digest('hex');
}

async function vendor(version, key) {
  const dir = join(KITS_DIR, key);
  console.log(`gen-map-kits: downloading kit "${key}" of core ${version}`);
  const manifestBuf = await download(version, `${key}/manifest.json`);
  const manifest = JSON.parse(manifestBuf.toString('utf8'));
  const notice = await download(version, `${key}/NOTICE.md`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'svg'), { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), manifestBuf);
  writeFileSync(join(dir, 'NOTICE.md'), notice);
  for (const a of manifest.assets) {
    if (!/^svg\/[a-z0-9_]+\.svg$/.test(a.file)) fail(`${key}/manifest.json: bad file "${a.file}"`);
    writeFileSync(join(dir, a.file), await download(version, `${key}/${a.file}`));
  }
}

// --- SVG → element tree --------------------------------------------------

function parseAttrs(file, tag, text) {
  const out = {};
  const re = /\s*([^\s=/>]+)\s*=\s*"([^"]*)"|\s*(\/)|\s*(\S+)/gy;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[3]) continue;
    if (m[4] !== undefined) fail(`${file}: <${tag}> malformed attribute "${m[4]}"`);
    if (m[1] in out) fail(`${file}: <${tag}> duplicate attribute "${m[1]}"`);
    out[m[1]] = m[2];
  }
  return out;
}

function convertValue(file, tag, name, prop, value) {
  const v = value.trim();
  if (/url\s*\(|javascript:|data:|&#|\\/i.test(v)) fail(`${file}: <${tag}> unsafe ${name}="${v}"`);
  if (prop === 'fill' || prop === 'stroke') {
    if (v === 'none') return 'none';
    const c = COLOUR_RE.exec(v);
    if (!c) fail(`${file}: <${tag}> ${name}="${v}" must be none or var(--beach-*, fallback)`);
    return `$${c[1]}`;
  }
  if (NUMERIC.has(prop)) {
    if (!NUMBER_RE.test(v)) fail(`${file}: <${tag}> ${name}="${v}" must be a plain number`);
    return Number(v);
  }
  return v;
}

/** Element tree of one SVG file: [tag, props, children | text]. */
function convertSvg(file, src) {
  const body = src
    .replace(/^\s*<svg\b[^>]*>/, (open) => {
      if (!open.includes(`viewBox="${VIEWBOX}"`)) fail(`${file}: viewBox must be "${VIEWBOX}"`);
      return '';
    })
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[^<]*<\/title>/, '');
  const root = { children: [] };
  const stack = [root];
  const re = /<(\/?)([a-z]+)([^>]*?)(\/?)>|([^<]+)/gy;
  let m;
  let pos = 0;
  while ((m = re.exec(body)) !== null) {
    pos = re.lastIndex;
    const [, close, tag, attrs, selfClose, text] = m;
    const top = stack[stack.length - 1];
    if (text !== undefined) {
      if (!text.trim()) continue;
      if (top.tag !== 'text') fail(`${file}: text outside <text>`);
      top.text = (top.text ?? '') + text.trim();
      continue;
    }
    if (close) {
      if (top.tag !== tag) fail(`${file}: unbalanced </${tag}>`);
      stack.pop();
      continue;
    }
    if (!ELEMENTS.has(tag)) fail(`${file}: element <${tag}> not allowed`);
    const props = {};
    for (const [name, value] of Object.entries(parseAttrs(file, tag, attrs))) {
      const prop = PROPS[name];
      if (!prop) fail(`${file}: <${tag}> attribute "${name}" not allowed`);
      props[prop] = convertValue(file, tag, name, prop, value);
    }
    const node = { tag, props, children: [] };
    top.children.push(node);
    if (!selfClose) stack.push(node);
  }
  if (pos !== body.length)
    fail(`${file}: cannot parse near offset ${pos}: ${body.slice(pos, pos + 40)}`);
  if (stack.length !== 1) fail(`${file}: unclosed <${stack[stack.length - 1].tag}>`);
  const pack = (n) => [n.tag, n.props, n.text ?? n.children.map(pack)];
  return root.children.map(pack);
}

function generate(pin) {
  const manifests = KITS.map(({ key }) =>
    JSON.parse(readFileSync(join(KITS_DIR, key, 'manifest.json'), 'utf8')),
  );
  const [first] = manifests;
  const catalogue = first.assets.map((a) => `${a.id}|${a.category}|${a.type}`).join('\n');
  manifests.forEach((m, i) => {
    if (m.viewBox !== VIEWBOX) fail(`${KITS[i].key}/manifest.json: viewBox must be "${VIEWBOX}"`);
    if (m.assets.map((a) => `${a.id}|${a.category}|${a.type}`).join('\n') !== catalogue) {
      fail(`${KITS[i].key}/manifest.json: catalogue differs from ${KITS[0].key}`);
    }
  });

  const header = (what) =>
    '// GENERATED FILE, DO NOT EDIT.\n' +
    `// ${what} from assets/map-kits of Arenile core ${pin.version} (scripts/gen-map-kits.mjs,\n` +
    "// 'make gen'). Artwork © Coste360 SRL, BSL 1.1: see assets/map-kits/*/NOTICE.md.\n";

  mkdirSync(OUT_DIR, { recursive: true });
  const ids = first.assets.map((a) => a.id);
  const assets = first.assets.map((a) => ({
    id: a.id,
    type: a.type === 'bookable' ? 'bookable' : a.type === 'decoration' ? 'decoration' : 'structure',
    tile: TILE_RE.test(a.id),
  }));
  writeFileSync(
    join(OUT_DIR, 'manifest.ts'),
    `${header('Catalogue of the kits')}\n` +
      `/** Kits of the core, the default first. */\n` +
      `export const MAP_KIT_KEYS = ${JSON.stringify(KITS.map((k) => k.key))} as const;\n\n` +
      `export type MapKitKey = (typeof MAP_KIT_KEYS)[number];\n\n` +
      `/** How each kit draws the status: \`fill\` paints the art's status part, \`halo\` a disc under it. */\n` +
      `export const MAP_KIT_STYLE: Readonly<Record<MapKitKey, 'fill' | 'halo'>> = ${JSON.stringify(
        Object.fromEntries(KITS.map((k) => [k.key, k.style])),
      )};\n\n` +
      `export const KIT_ASSET_IDS = ${JSON.stringify(ids, null, 2)} as const;\n\n` +
      `export type KitAssetId = (typeof KIT_ASSET_IDS)[number];\n\n` +
      `export interface KitAssetInfo {\n  id: KitAssetId;\n  type: 'bookable' | 'structure' | 'decoration';\n  /** Modular walkway tile, repeated along the long side. */\n  tile: boolean;\n}\n\n` +
      `export const KIT_ASSETS: readonly KitAssetInfo[] = ${JSON.stringify(assets, null, 2)};\n`,
  );

  KITS.forEach(({ key }, i) => {
    const entries = manifests[i].assets.map((a) => {
      const file = `${key}/${a.file}`;
      let tree = convertSvg(file, readFileSync(join(KITS_DIR, key, a.file), 'utf8'));
      const fix = NORMALISE[key]?.[a.id];
      if (fix) tree = [['g', { transform: fix }, tree]];
      return `  ${a.id}: ${JSON.stringify(tree)},`;
    });
    writeFileSync(
      join(OUT_DIR, `art-${key}.ts`),
      `${header(`Art of the "${key}" kit (v${manifests[i].version})`)}\n` +
        `import type { KitArt } from '../art-types';\n\n` +
        `export const KIT_ART: KitArt = {\n${entries.join('\n')}\n};\n`,
    );
  });
  console.log(`gen-map-kits: wrote src/features/day-map/kit/generated from core ${pin.version}`);
}

async function main() {
  const pin = JSON.parse(readFileSync(PIN_FILE, 'utf8'));
  const lock = existsSync(LOCK_FILE) ? JSON.parse(readFileSync(LOCK_FILE, 'utf8')) : null;
  const current = lock?.version === pin.version;
  const next = { version: pin.version, kits: {} };
  for (const { key } of KITS) {
    const hash = kitHash(key);
    if (current && hash && hash === lock.kits?.[key]) {
      next.kits[key] = hash;
      continue;
    }
    if (offline) {
      fail(
        `assets/map-kits/${key} does not match core ${pin.version} in assets/map-kits/kits.lock.json. ` +
          "Run 'make gen' (it downloads the kits of the pinned release) and commit the result.",
      );
    }
    if (current && lock.kits?.[key]) {
      // Same release, files changed locally: restore them and check they hash as recorded.
      await vendor(pin.version, key);
      const got = kitHash(key);
      if (got !== lock.kits[key])
        fail(`checksum mismatch for kit ${key}: expected ${lock.kits[key]}, got ${got}`);
      next.kits[key] = got;
    } else {
      await vendor(pin.version, key);
      next.kits[key] = kitHash(key);
      console.log(
        `gen-map-kits: pinned kit ${key} of core ${pin.version} (sha256 ${next.kits[key]})`,
      );
    }
  }
  writeFileSync(LOCK_FILE, `${JSON.stringify(next, null, 2)}\n`);
  generate(pin);
}

main().catch((err) => {
  console.error(`gen-map-kits: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
