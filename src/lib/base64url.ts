// Strict base64url (RFC 4648 §5, no padding) and UTF-8 decoding in plain
// TypeScript: Hermes has no Buffer and no guaranteed TextDecoder, and the
// pairing QR carries the establishment name, which may contain accents.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOOKUP = new Map<string, number>([...ALPHABET].map((c, i) => [c, i]));

/**
 * Decodes unpadded base64url into bytes, like Go's base64.RawURLEncoding:
 * padding, characters outside the URL-safe alphabet and impossible lengths
 * are rejected (null).
 */
export function decodeBase64Url(input: string): Uint8Array | null {
  if (input.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((input.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (const ch of input) {
    const v = LOOKUP.get(ch);
    if (v === undefined) return null;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}

/** Decodes UTF-8 bytes; invalid sequences become U+FFFD (as Go's JSON decoder does). */
export function decodeUtf8(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i] ?? 0;
    let cp = 0xfffd;
    let len = 1;
    if (b0 < 0x80) {
      cp = b0;
    } else if (b0 >= 0xc2 && b0 <= 0xf4) {
      len = b0 < 0xe0 ? 2 : b0 < 0xf0 ? 3 : 4;
      let v = b0 & (0xff >> (len + 1));
      let ok = i + len <= bytes.length;
      for (let k = 1; ok && k < len; k++) {
        const b = bytes[i + k] ?? 0;
        if ((b & 0xc0) !== 0x80) ok = false;
        else v = (v << 6) | (b & 0x3f);
      }
      const min = len === 2 ? 0x80 : len === 3 ? 0x800 : 0x10000;
      if (ok && v >= min && v <= 0x10ffff && !(v >= 0xd800 && v <= 0xdfff)) cp = v;
      else len = 1;
    }
    out += String.fromCodePoint(cp);
    i += len;
  }
  return out;
}
