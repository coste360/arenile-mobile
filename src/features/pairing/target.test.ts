import { LAN_FINGERPRINT } from '@/test/fake-fetch';

import { QR_PREFIX } from './qr';
import {
  normalizeInstanceUrl,
  normalizePairingCode,
  targetFromLinkData,
  targetFromManual,
  targetFromQR,
} from './target';

const b64 = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString('base64url');

describe('normalizePairingCode', () => {
  // TestPairingCode_Scenarios of the core (internal/domain/device/token_test.go).
  it.each([
    ['ABCD-EFGH', 'ABCDEFGH'],
    ['abcd-efgh', 'ABCDEFGH'],
    [' ab cd ef gh ', 'ABCDEFGH'],
    ['O1IL-2345', '01112345'],
    ['ABCD-EFG', null],
    ['ABCD-EFGHJ', null],
    ['ABCD-EFGU', null],
    ['', null],
    ['ABCD_EFGH', null],
  ])('%j -> %j', (input, expected) => {
    expect(normalizePairingCode(input)).toBe(expected);
  });
});

describe('normalizeInstanceUrl', () => {
  it.each([
    ['lido.example.it', 'https://lido.example.it'],
    ['  https://lido.example.it/admin/  ', 'https://lido.example.it'],
    ['HTTPS://Lido.example.it:8443', 'https://Lido.example.it:8443'],
    ['http://localhost:8080', 'http://localhost:8080'],
    ['http://127.0.0.1:8080/x', 'http://127.0.0.1:8080'],
    ['http://[::1]:8080', 'http://[::1]:8080'],
    ['192.168.1.20:8443', 'https://192.168.1.20:8443'],
  ])('%j -> %j', (input, expected) => {
    expect(normalizeInstanceUrl(input)).toEqual({ ok: true, url: expected });
  });

  it.each([
    ['', 'invalid_input'],
    ['https://', 'invalid_input'],
    ['https://user:pw@lido.it', 'invalid_input'],
    ['ftp://lido.it', 'invalid_input'],
    ['https://li do.it', 'invalid_input'],
    ['http://lido.example.it', 'insecure_url'],
    ['http://192.168.1.20:8080', 'insecure_url'],
    ['http://127.0.0.1.nip.io', 'insecure_url'],
    ['https://a.it:abc', 'invalid_input'],
    ['https://a.it:80:90', 'invalid_input'],
    ['https://[::1', 'invalid_input'],
    ['https://[::1]x', 'invalid_input'],
    ['https://a[b].it', 'invalid_input'],
  ])('%j -> %s', (input, error) => {
    expect(normalizeInstanceUrl(input)).toEqual({ ok: false, error });
  });
});

describe('targetFromQR', () => {
  it('normalises address, code and fingerprint', () => {
    const text =
      QR_PREFIX +
      b64({
        v: 1,
        url: 'https://192.168.1.20:8443/',
        code: 'abcd-efgh',
        fingerprint: LAN_FINGERPRINT.toLowerCase(),
        establishment_name: 'Lido Azzurro',
      });
    expect(targetFromQR(text)).toEqual({
      ok: true,
      target: {
        url: 'https://192.168.1.20:8443',
        code: 'ABCDEFGH',
        fingerprint: LAN_FINGERPRINT,
        establishmentName: 'Lido Azzurro',
      },
    });
  });

  it.each([
    ['not a QR of Arenile', 'https://lido.example.it', 'invalid_input'],
    ['bad code', QR_PREFIX + b64({ v: 1, url: 'https://a.it', code: 'XYZ' }), 'invalid_input'],
    [
      'http on the network',
      QR_PREFIX + b64({ v: 1, url: 'http://a.it', code: 'ABCDEFGH' }),
      'insecure_url',
    ],
    [
      'a malformed certificate fingerprint',
      QR_PREFIX +
        b64({ v: 1, url: 'https://192.168.1.20:8443', code: 'ABCDEFGH', fingerprint: 'AA:BB' }),
      'invalid_input',
    ],
  ])('rejects %s', (_name, text, error) => {
    expect(targetFromQR(text)).toEqual({ ok: false, error });
  });
});

describe('targetFromLinkData', () => {
  it('accepts the d parameter of arenile://pair', () => {
    expect(targetFromLinkData(b64({ v: 1, url: 'https://a.it', code: 'ABCD-EFGH' }))).toEqual({
      ok: true,
      target: { url: 'https://a.it', code: 'ABCDEFGH' },
    });
  });

  it('rejects garbage', () => {
    expect(targetFromLinkData('%%%')).toEqual({ ok: false, error: 'invalid_input' });
  });
});

describe('targetFromManual', () => {
  it.each([
    [
      'lido.example.it',
      'abcd efgh',
      { ok: true, target: { url: 'https://lido.example.it', code: 'ABCDEFGH' } },
    ],
    ['', 'ABCDEFGH', { ok: false, error: 'invalid_input' }],
    ['lido.example.it', '', { ok: false, error: 'invalid_input' }],
    ['lido.example.it', 'ABC', { ok: false, error: 'invalid_input' }],
    ['http://lido.example.it', 'ABCDEFGH', { ok: false, error: 'insecure_url' }],
  ])('(%j, %j)', (url, code, expected) => {
    expect(targetFromManual(url, code)).toEqual(expected);
  });
});
