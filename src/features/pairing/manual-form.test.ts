import { manualPairingSchema } from './manual-form';

const errors = (values: { url: string; code: string }) => {
  const r = manualPairingSchema.safeParse(values);
  return r.success
    ? {}
    : Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]));
};

describe('manualPairingSchema', () => {
  it.each([
    ['valid', { url: 'lido.example.it', code: 'abcd-efgh' }, {}],
    ['valid with scheme and path', { url: 'https://lido.example.it/admin', code: 'ABCDEFGH' }, {}],
    [
      'empty',
      { url: ' ', code: '' },
      { url: 'manual.errors.urlRequired', code: 'manual.errors.codeInvalid' },
    ],
    [
      'plain http',
      { url: 'http://lido.example.it', code: 'ABCDEFGH' },
      { url: 'manual.errors.urlInsecure' },
    ],
    [
      'bad address',
      { url: 'https://li do.it', code: 'ABCDEFGH' },
      { url: 'manual.errors.urlInvalid' },
    ],
    ['short code', { url: 'lido.example.it', code: 'ABC' }, { code: 'manual.errors.codeInvalid' }],
    [
      'code with U',
      { url: 'lido.example.it', code: 'ABCD-EFGU' },
      { code: 'manual.errors.codeInvalid' },
    ],
  ])('%s', (_name, values, expected) => {
    expect(errors(values)).toEqual(expected);
  });
});
