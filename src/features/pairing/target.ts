// Pairing target: the instance address and the pairing code, from the QR or
// typed by hand. Same rules as ParseInput / NormalizeInstanceURL of the core
// desktop client (internal/desktop/remote/pair.go) and NormalizePairingCode
// (internal/domain/device/token.go).
import { parseAuthority } from './authority';
import { decodeQR, decodeQRData, type QRPayload } from './qr';

export interface PairingTarget {
  /** scheme://host[:port] of the instance. */
  url: string;
  /** Canonical 8-character pairing code. */
  code: string;
  /** SHA-256 of the self-signed certificate (desktop LAN mode), upper case. */
  fingerprint?: string;
  establishmentName?: string;
}

export type TargetError = 'invalid_input' | 'insecure_url';

export type TargetResult = { ok: true; target: PairingTarget } | { ok: false; error: TargetError };

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PAIRING_CODE_LENGTH = 8;

/**
 * Turns user input into the canonical code: case-insensitive, spaces and
 * dashes ignored, Crockford aliases (O->0, I/L->1). Null for any other shape.
 */
export function normalizePairingCode(input: string): string | null {
  let out = '';
  for (let ch of input.toUpperCase()) {
    if (ch === ' ' || ch === '-') continue;
    if (ch === 'O') ch = '0';
    if (ch === 'I' || ch === 'L') ch = '1';
    if (!CROCKFORD.includes(ch)) return null;
    out += ch;
  }
  return out.length === PAIRING_CODE_LENGTH ? out : null;
}

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '::1') return true;
  const v4 = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  return !!v4 && v4.slice(1).every((p) => Number(p) <= 255) && v4[1] === '127';
}

/**
 * Returns scheme://host[:port] of an instance address. A bare host gets
 * https. Plain http is accepted only on loopback (development): the device
 * token must never cross a network in clear.
 */
export function normalizeInstanceUrl(
  raw: string,
): { ok: true; url: string } | { ok: false; error: TargetError } {
  let s = raw.trim();
  if (!s.includes('://')) s = `https://${s}`;
  if (/[\s\u0000-\u001f\u007f]/.test(s)) return { ok: false, error: 'invalid_input' };
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i.exec(s);
  if (!m) return { ok: false, error: 'invalid_input' };
  const scheme = (m[1] ?? '').toLowerCase();
  const authority = parseAuthority(m[2] ?? '');
  if (!authority || authority.hasUserInfo || authority.hostname === '') {
    return { ok: false, error: 'invalid_input' };
  }
  const { host, hostname } = authority;
  if (scheme === 'https') return { ok: true, url: `${scheme}://${host}` };
  if (scheme === 'http') {
    return isLoopbackHost(hostname)
      ? { ok: true, url: `${scheme}://${host}` }
      : { ok: false, error: 'insecure_url' };
  }
  return { ok: false, error: 'invalid_input' };
}

/** Builds the target from a decoded QR payload. */
export function targetFromPayload(p: QRPayload): TargetResult {
  const u = normalizeInstanceUrl(p.url);
  if (!u.ok) return u;
  const code = normalizePairingCode(p.code);
  if (!code) return { ok: false, error: 'invalid_input' };
  const target: PairingTarget = { url: u.url, code };
  if (p.fingerprint) target.fingerprint = p.fingerprint.trim().toUpperCase();
  if (p.establishment_name) target.establishmentName = p.establishment_name;
  return { ok: true, target };
}

/** Builds the target from the QR text (camera scan). */
export function targetFromQR(text: string): TargetResult {
  const p = decodeQR(text.trim());
  return p ? targetFromPayload(p) : { ok: false, error: 'invalid_input' };
}

/** Builds the target from the `d` parameter of an `arenile://pair` link. */
export function targetFromLinkData(data: string): TargetResult {
  const p = decodeQRData(data);
  return p ? targetFromPayload(p) : { ok: false, error: 'invalid_input' };
}

/** Builds the target from the address and code typed by hand. */
export function targetFromManual(url: string, code: string): TargetResult {
  if (url.trim() === '' || code.trim() === '') return { ok: false, error: 'invalid_input' };
  const u = normalizeInstanceUrl(url);
  if (!u.ok) return u;
  const c = normalizePairingCode(code);
  return c ? { ok: true, target: { url: u.url, code: c } } : { ok: false, error: 'invalid_input' };
}
