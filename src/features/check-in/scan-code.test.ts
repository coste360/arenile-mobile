import { normalizeCode, parseScanned, parseTyped, type ScannedCode } from './scan-code';

const TOKEN = 'MFRGGZDFMZTWQ2LKNNWG23TPOA';

describe('normalizeCode (core ticketing.NormalizeCode)', () => {
  it.each([
    ['  abc  ', 'ABC'],
    ['https://lido.example.it/t/mfrggzdfmztwq2lknnwg23tpoa', TOKEN],
    ['a/b/ c ', 'C'],
    ['', ''],
  ])('%j → %j', (raw, want) => {
    expect(normalizeCode(raw)).toBe(want);
  });
});

describe('parseScanned', () => {
  it.each<[string, ScannedCode]>([
    ['ARENILE:AR-7K3Q9', { kind: 'booking', code: 'AR-7K3Q9' }],
    ['arenile:ar-7k3q9', { kind: 'booking', code: 'AR-7K3Q9' }],
    ['  ARENILE: LA2026-000123 ', { kind: 'booking', code: 'LA2026-000123' }],
    [TOKEN, { kind: 'ticket', token: TOKEN }],
    [TOKEN.toLowerCase(), { kind: 'ticket', token: TOKEN }],
    [`https://lido.example.it/gate/${TOKEN}`, { kind: 'ticket', token: TOKEN }],
    ['ARENILE:', { kind: 'unknown' }],
    ['ARENILE:<script>', { kind: 'unknown' }],
    ['https://example.com/menu', { kind: 'unknown' }],
    // A base32 token is exactly 26 characters; 0, 1, 8 and 9 are not base32.
    [TOKEN.slice(1), { kind: 'unknown' }],
    ['MFRGGZDFMZTWQ2LKNNWG23TP01', { kind: 'unknown' }],
    // A typed code alone is not a QR of Arenile.
    ['AR-7K3Q9', { kind: 'unknown' }],
    ['37', { kind: 'unknown' }],
  ])('%j', (payload, want) => {
    expect(parseScanned(payload)).toEqual(want);
  });
});

describe('parseTyped', () => {
  it.each<[string, ScannedCode]>([
    ['ar-7k3q9', { kind: 'booking', code: 'AR-7K3Q9' }],
    [' LA2026-000123 ', { kind: 'booking', code: 'LA2026-000123' }],
    ['ARENILE:AR-7K3Q9', { kind: 'booking', code: 'AR-7K3Q9' }],
    ['37', { kind: 'ticket_number', number: 37 }],
    ['#037', { kind: 'ticket_number', number: 37 }],
    ['0', { kind: 'unknown' }],
    [TOKEN, { kind: 'ticket', token: TOKEN }],
    ['', { kind: 'unknown' }],
    ['Rossi Mario', { kind: 'unknown' }],
  ])('%j', (input, want) => {
    expect(parseTyped(input)).toEqual(want);
  });
});
