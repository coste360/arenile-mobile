import { normalizeFingerprint } from './fingerprint';

// Output of the core's desktop.Fingerprint for a sample certificate.
const CANONICAL =
  'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89';

describe('normalizeFingerprint', () => {
  it.each([
    ['canonical form', CANONICAL, CANONICAL],
    ['lower case', CANONICAL.toLowerCase(), CANONICAL],
    ['surrounding spaces', `  ${CANONICAL}\n`, CANONICAL],
    ['plain hex', CANONICAL.replaceAll(':', ''), CANONICAL],
  ])('accepts the %s', (_, raw, expected) => {
    expect(normalizeFingerprint(raw)).toBe(expected);
  });

  it.each([
    ['empty', ''],
    ['too short', 'AA:BB'],
    ['SHA-1 length', CANONICAL.slice(0, 59)],
    ['one byte too many', `${CANONICAL}:00`],
    ['non-hex digit', CANONICAL.replace('AB', 'AG')],
    ['mixed separators', CANONICAL.replace(':', '-')],
    ['missing separator', CANONICAL.replace(':', '')],
    ['full-width digits', CANONICAL.replace('01', '０１')],
  ])('rejects %s', (_, raw) => {
    expect(normalizeFingerprint(raw)).toBeNull();
  });
});
