import { localizedText } from './i18n-text';

describe('localizedText', () => {
  it.each([
    [{ it: 'Prima fila', de: 'Erste Reihe' }, 'de', 'Erste Reihe'],
    [{ it: 'Prima fila', de: 'Erste Reihe' }, 'de-AT', 'Erste Reihe'],
    [{ it: 'Prima fila', de: 'Erste Reihe' }, 'fr', 'Prima fila'],
    [{ it: 'Prima fila', en: '  ' }, 'en', 'Prima fila'],
    [{ en: 'Front row' }, 'fr', 'Front row'],
    [{}, 'it', ''],
    [undefined, 'it', ''],
  ])('%j in %s -> %j', (text, locale, expected) => {
    expect(localizedText(text, locale)).toBe(expected);
  });
});
