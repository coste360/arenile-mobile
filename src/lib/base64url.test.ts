import { decodeBase64Url, decodeUtf8 } from './base64url';

const text = (s: string) => {
  const bytes = decodeBase64Url(s);
  return bytes ? decodeUtf8(bytes) : null;
};

describe('decodeBase64Url', () => {
  it.each([
    ['', ''],
    ['e30', '{}'],
    ['YQ', 'a'],
    ['YWI', 'ab'],
    ['YWJj', 'abc'],
    // "Lido Società" (UTF-8 multi-byte).
    ['TGlkbyBTb2NpZXTDoA', 'Lido Società'],
    // URL-safe alphabet: bytes 0xfb 0xff -> "-_8".
    ['-_8', '��'],
  ])('decodes %j', (input, expected) => {
    expect(text(input)).toBe(expected);
  });

  it.each([
    ['padding', 'YQ=='],
    ['standard alphabet +', 'a+b'],
    ['standard alphabet /', 'a/b'],
    ['impossible length', 'YWJjZ'],
    ['space', 'YW Jj'],
    ['non-ascii', 'YWJà'],
  ])('rejects %s', (_name, input) => {
    expect(decodeBase64Url(input)).toBeNull();
  });
});

describe('decodeUtf8', () => {
  it.each([
    ['ascii', [0x41], 'A'],
    ['two bytes', [0xc3, 0xa8], 'è'],
    ['three bytes', [0xe2, 0x82, 0xac], '€'],
    ['four bytes', [0xf0, 0x9f, 0x8f, 0x96], '🏖'],
    ['truncated', [0xc3], '�'],
    ['overlong', [0xc0, 0x80], '��'],
    ['surrogate', [0xed, 0xa0, 0x80], '���'],
    ['stray continuation', [0x80, 0x41], '�A'],
  ])('%s', (_name, bytes, expected) => {
    expect(decodeUtf8(new Uint8Array(bytes))).toBe(expected);
  });
});
