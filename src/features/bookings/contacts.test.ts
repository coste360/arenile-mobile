import { contactLinks } from './contacts';

describe('contactLinks', () => {
  it.each([
    [
      'an E.164 number',
      { phone: '+393331234567' },
      { call: 'tel:+393331234567', whatsapp: 'https://wa.me/393331234567' },
    ],
    [
      'an E.164 number with spaces',
      { phone: '+39 333 123 4567' },
      { call: 'tel:+393331234567', whatsapp: 'https://wa.me/393331234567' },
    ],
    ['a national number: call only', { phone: '333 1234567' }, { call: 'tel:3331234567' }],
    ['a number with letters: nothing', { phone: 'chiedere in cassa' }, {}],
    ['an email', { email: ' anna@example.it ' }, { email: 'mailto:anna@example.it' }],
    ['a malformed email', { email: 'anna@' }, {}],
    ['no contacts', {}, {}],
  ])('%s', (_name, contacts, expected) => {
    expect(contactLinks(contacts)).toEqual(expected);
  });
});
