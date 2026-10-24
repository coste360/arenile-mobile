#!/usr/bin/env node
// Generates the TypeScript API types from the OpenAPI contract of a PINNED
// Arenile core release (ADR 0002). Run through make:
//
//   make gen                       verify api/openapi.yaml against api/core-version.json
//                                  (download it from the release when missing or stale),
//                                  then write src/api/generated/schema.d.ts
//   make gen-check                 same, offline, and fail if the generated code differs
//                                  from what is committed
//   make api-bump VERSION=v1.0.2   pin another core release (download, record SHA-256),
//                                  then regenerate
//
// The app never imports core code: api/openapi.yaml is the verbatim `openapi.yaml`
// asset of the release, checked byte for byte with SHA-256. Never edit it or the
// generated file by hand (the guard-generated hook blocks it).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PIN_FILE = join(ROOT, 'api', 'core-version.json');
const SPEC_FILE = join(ROOT, 'api', 'openapi.yaml');
const OUT_FILE = join(ROOT, 'src', 'api', 'generated', 'schema.d.ts');
const RELEASE_URL = (version) =>
  `https://github.com/coste360/arenile/releases/download/${version}/openapi.yaml`;
const VERSION_RE = /^v\d+\.\d+\.\d+$/;

const args = process.argv.slice(2);
const offline = args.includes('--offline');
const bumpIndex = args.indexOf('--bump');
const bumpTo = bumpIndex >= 0 ? args[bumpIndex + 1] : undefined;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const fail = (msg) => {
  console.error(`gen-api: ${msg}`);
  process.exit(1);
};

async function download(version) {
  const url = RELEASE_URL(version);
  console.log(`gen-api: downloading ${url}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) fail(`download failed: HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  if (bumpTo !== undefined) {
    if (!VERSION_RE.test(bumpTo)) fail(`--bump needs a release tag like v1.0.2, got "${bumpTo}"`);
    const spec = await download(bumpTo);
    const pin = { version: bumpTo, sha256: sha256(spec), source: RELEASE_URL(bumpTo) };
    writeFileSync(PIN_FILE, `${JSON.stringify(pin, null, 2)}\n`);
    writeFileSync(SPEC_FILE, spec);
    console.log(`gen-api: pinned core ${bumpTo} (sha256 ${pin.sha256})`);
  }

  const pin = JSON.parse(readFileSync(PIN_FILE, 'utf8'));
  if (!VERSION_RE.test(pin.version) || !/^[0-9a-f]{64}$/.test(pin.sha256)) {
    fail(`${PIN_FILE} must contain a release tag "version" and a hex "sha256"`);
  }

  let spec = existsSync(SPEC_FILE) ? readFileSync(SPEC_FILE) : null;
  if (!spec || sha256(spec) !== pin.sha256) {
    if (offline) {
      fail(
        `api/openapi.yaml does not match core ${pin.version} (sha256 ${pin.sha256}). ` +
          "Run 'make gen' (it downloads the pinned release) and commit the result.",
      );
    }
    spec = await download(pin.version);
    const got = sha256(spec);
    if (got !== pin.sha256) {
      fail(`checksum mismatch for core ${pin.version}: expected ${pin.sha256}, got ${got}`);
    }
    writeFileSync(SPEC_FILE, spec);
  }

  const { default: openapiTS, astToString } = await import('openapi-typescript');
  const ast = await openapiTS(pathToFileURL(SPEC_FILE));
  const header =
    '/**\n' +
    ' * GENERATED FILE, DO NOT EDIT.\n' +
    ` * Source: openapi.yaml of Arenile core ${pin.version} (sha256 ${pin.sha256}).\n` +
    " * Regenerate with 'make gen' (scripts/gen-api.mjs, openapi-typescript).\n" +
    ' */\n\n';
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, header + astToString(ast));
  console.log(`gen-api: wrote src/api/generated/schema.d.ts from core ${pin.version}`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
