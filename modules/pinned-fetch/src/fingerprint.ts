// Certificate fingerprints of the desktop LAN server (core internal/desktop/lan.go,
// `Fingerprint`): SHA-256 of the leaf certificate in DER, upper-case hex bytes
// separated by ":" (95 characters). The comparison itself happens in native
// code, in constant time; here we only validate and canonicalise.

const COLON_FORM = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const PLAIN_FORM = /^[0-9A-F]{64}$/;

/**
 * Returns the canonical form (`AA:BB:…`, 32 bytes) of a SHA-256 fingerprint,
 * accepting any letter case and the plain 64-digit hex form; null when the
 * value is not a SHA-256 fingerprint.
 */
export function normalizeFingerprint(raw: string): string | null {
  const value = raw.trim().toUpperCase();
  if (COLON_FORM.test(value)) return value;
  if (PLAIN_FORM.test(value)) return value.match(/../g)!.join(':');
  return null;
}
