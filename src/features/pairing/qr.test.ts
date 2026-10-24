import { decodeQR, decodeQRData, hasHttpHost, QR_PREFIX } from './qr';

/** Encodes like EncodeQR of the core: arenile://pair?d=<base64url(JSON), no padding>. */
const encode = (payload: unknown) =>
  QR_PREFIX + Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
const raw = (json: string) => QR_PREFIX + Buffer.from(json, 'utf8').toString('base64url');

describe('decodeQR', () => {
  // TestQR_RoundTrip of the core (internal/domain/device/token_test.go).
  it('round-trips the core example with a fingerprint', () => {
    const text = encode({
      v: 1,
      url: 'https://192.168.1.20:8443',
      code: 'ABCD-EFGH',
      fingerprint: 'AA:BB',
    });
    expect(decodeQR(text)).toEqual({
      v: 1,
      url: 'https://192.168.1.20:8443',
      code: 'ABCD-EFGH',
      fingerprint: 'AA:BB',
    });
  });

  it('keeps the establishment name, accents included', () => {
    const text = encode({
      v: 1,
      url: 'https://lido.example.it',
      code: 'ABCD-EFGH',
      establishment_name: 'Lido Società',
    });
    expect(decodeQR(text)).toEqual({
      v: 1,
      url: 'https://lido.example.it',
      code: 'ABCD-EFGH',
      establishment_name: 'Lido Società',
    });
  });

  it.each([
    ['plain http', { v: 1, url: 'http://localhost:8080', code: 'X' }],
    ['upper-case scheme', { v: 1, url: 'HTTPS://lido.example.it', code: 'X' }],
    ['path and port', { v: 1, url: 'https://lido.example.it:8443/arenile', code: 'X' }],
    ['unknown fields ignored', { v: 1, url: 'https://a.it', code: 'X', extra: true }],
    ['null optional fields', { v: 1, url: 'https://a.it', code: 'X', fingerprint: null }],
  ])('accepts %s', (_name, payload) => {
    expect(decodeQR(encode(payload))).not.toBeNull();
  });

  it.each([
    // The core's invalid inputs.
    ['empty', ''],
    ['not a pairing link', 'https://x'],
    ['bad base64', 'arenile://pair?d=!!'],
    ['empty object', 'arenile://pair?d=e30'],
    // Prefix and encoding.
    ['other scheme', 'arenilex://pair?d=e30'],
    ['other path', 'arenile://login?d=e30'],
    ['padded base64', `${encode({ v: 1, url: 'https://a.it', code: 'XY' })}==`],
    ['not JSON', raw('not json')],
    ['JSON array', raw('[1]')],
    ['JSON null', raw('null')],
    ['JSON string', raw('"x"')],
    // Version.
    ['missing v', encode({ url: 'https://a.it', code: 'X' })],
    ['v 2', encode({ v: 2, url: 'https://a.it', code: 'X' })],
    ['v as string', encode({ v: '1', url: 'https://a.it', code: 'X' })],
    // Code.
    ['missing code', encode({ v: 1, url: 'https://a.it' })],
    ['empty code', encode({ v: 1, url: 'https://a.it', code: '' })],
    ['numeric code', encode({ v: 1, url: 'https://a.it', code: 12345678 })],
    // URL.
    ['missing url', encode({ v: 1, code: 'X' })],
    ['ftp url', encode({ v: 1, url: 'ftp://a.it', code: 'X' })],
    ['no host', encode({ v: 1, url: 'https://', code: 'X' })],
    ['no host with path', encode({ v: 1, url: 'https:///admin', code: 'X' })],
    ['relative url', encode({ v: 1, url: 'lido.example.it', code: 'X' })],
    ['space in url', encode({ v: 1, url: 'https://li do.it', code: 'X' })],
    // Optional fields with the wrong type.
    ['numeric fingerprint', encode({ v: 1, url: 'https://a.it', code: 'X', fingerprint: 1 })],
    ['object name', encode({ v: 1, url: 'https://a.it', code: 'X', establishment_name: {} })],
  ])('rejects %s', (_name, text) => {
    expect(decodeQR(text)).toBeNull();
  });
});

describe('decodeQRData', () => {
  it('decodes the d parameter of a deep link', () => {
    const d = Buffer.from(JSON.stringify({ v: 1, url: 'https://a.it', code: 'X' })).toString(
      'base64url',
    );
    expect(decodeQRData(d)).toEqual({ v: 1, url: 'https://a.it', code: 'X' });
  });
});

describe('hasHttpHost', () => {
  it.each([
    ['https://a.it', true],
    ['https://user@a.it', true],
    ['https://:443', true],
    ['https://user@', false],
    ['https://a.it:abc', false],
    ['https://[::1', false],
    ['https://[::1]:8443', true],
    ['mailto:a@b.it', false],
  ])('%j -> %j', (url, expected) => {
    expect(hasHttpHost(url)).toBe(expected);
  });
});
