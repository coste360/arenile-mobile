// Decoder of the pairing QR shown by the panel (Configurazione -> Dispositivi).
// Same format and rules as DecodeQR of the core (internal/domain/device/qr.go):
//   arenile://pair?d=<base64url(JSON)>, JSON {v:1, url, code, fingerprint?, establishment_name?}
//   - v must be 1 and code non-empty;
//   - url must be http or https with a host.
// Known difference: Go's JSON decoder matches keys case-insensitively; the core
// encoder only writes lowercase keys, so this decoder accepts lowercase only.
import type { DevicePairingQRPayload } from '@/api/types';
import { decodeBase64Url, decodeUtf8 } from '@/lib/base64url';

import { parseAuthority } from './authority';

export const QR_VERSION = 1;
export const QR_PREFIX = 'arenile://pair?d=';

export type QRPayload = DevicePairingQRPayload;

const isOptionalString = (v: unknown) => v === undefined || v === null || typeof v === 'string';

/** Reports whether `raw` is an http(s) URL with a host (the core's url.Parse check). */
export function hasHttpHost(raw: string): boolean {
  // url.Parse rejects spaces and control characters.
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) return false;
  const m = /^(https?):\/\/([^/?#]*)/i.exec(raw);
  if (!m) return false;
  const a = parseAuthority(m[2] ?? '');
  return a !== null && a.host.length > 0;
}

/**
 * Decodes the `d` parameter of a pairing link (base64url JSON). Returns null
 * for anything that is not a valid pairing payload.
 */
export function decodeQRData(data: string): QRPayload | null {
  const bytes = decodeBase64Url(data);
  if (!bytes) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeUtf8(bytes));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  if (o.v !== QR_VERSION) return null;
  if (typeof o.code !== 'string' || o.code === '') return null;
  if (typeof o.url !== 'string' || !hasHttpHost(o.url)) return null;
  if (!isOptionalString(o.fingerprint) || !isOptionalString(o.establishment_name)) return null;

  const out: QRPayload = { v: QR_VERSION, url: o.url, code: o.code };
  if (typeof o.fingerprint === 'string' && o.fingerprint !== '') out.fingerprint = o.fingerprint;
  if (typeof o.establishment_name === 'string' && o.establishment_name !== '') {
    out.establishment_name = o.establishment_name;
  }
  return out;
}

/** Decodes the full QR text (`arenile://pair?d=…`). Returns null when it is not a pairing QR. */
export function decodeQR(text: string): QRPayload | null {
  if (!text.startsWith(QR_PREFIX)) return null;
  return decodeQRData(text.slice(QR_PREFIX.length));
}
