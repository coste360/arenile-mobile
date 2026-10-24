// Semantic version comparison, mirroring VersionAtLeast of the core
// (internal/desktop/remote/pair.go) so that the app and the desktop client
// judge compatibility the same way.

type Triple = [number, number, number];

function parseSemver(raw: string | null | undefined): Triple | null {
  let s = (raw ?? '').trim();
  if (s.startsWith('v')) s = s.slice(1);
  const cut = s.search(/[-+]/);
  if (cut >= 0) s = s.slice(0, cut);
  const parts = s.split('.');
  if (s === '' || parts.length > 3) return null;
  const out: Triple = [0, 0, 0];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i] ?? '';
    if (!/^\d+$/.test(p)) return null;
    out[i] = Number(p);
  }
  return out;
}

/**
 * Reports whether `version >= minimum` (major.minor.patch; "v" prefix and
 * pre-release/build suffix ignored). A version or minimum that does not
 * parse (a development build "dev", an empty string) always passes, like
 * the core.
 */
export function versionAtLeast(
  version: string | null | undefined,
  minimum: string | null | undefined,
): boolean {
  const v = parseSemver(version);
  const m = parseSemver(minimum);
  if (!v || !m) return true;
  for (let i = 0; i < 3; i++) {
    if (v[i] !== m[i]) return (v[i] ?? 0) > (m[i] ?? 0);
  }
  return true;
}
