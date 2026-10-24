import { parseAuthority } from './authority';

describe('parseAuthority', () => {
  it.each([
    ['lido.it', { hostname: 'lido.it', host: 'lido.it', hasUserInfo: false }],
    ['lido.it:8443', { hostname: 'lido.it', host: 'lido.it:8443', hasUserInfo: false }],
    ['lido.it:', { hostname: 'lido.it', host: 'lido.it:', hasUserInfo: false }],
    ['[::1]:8080', { hostname: '::1', host: '[::1]:8080', hasUserInfo: false }],
    ['u:p@lido.it', { hostname: 'lido.it', host: 'lido.it', hasUserInfo: true }],
    [':443', { hostname: '', host: ':443', hasUserInfo: false }],
  ])('%j', (input, expected) => {
    expect(parseAuthority(input)).toEqual(expected);
  });

  it.each(['lido.it:abc', 'lido.it:80:90', '[::1', '[::1]x', '[::1]:x', 'a]b'])(
    'rejects %j',
    (input) => {
      expect(parseAuthority(input)).toBeNull();
    },
  );
});
