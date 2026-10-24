import { createI18n, matchLocale, MESSAGES, resolveLocale, SUPPORTED_LOCALES } from './index';

function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

function placeholders(obj: unknown, prefix = ''): Record<string, string[]> {
  if (typeof obj === 'string')
    return { [prefix]: [...obj.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1] ?? '').sort() };
  if (typeof obj !== 'object' || obj === null) return {};
  return Object.assign(
    {},
    ...Object.entries(obj).map(([k, v]) => placeholders(v, prefix ? `${prefix}.${k}` : k)),
  );
}

describe('locale files', () => {
  const source = keys(MESSAGES.it).sort();

  it.each(SUPPORTED_LOCALES.filter((l) => l !== 'it'))(
    '%s has exactly the Italian keys',
    (locale) => {
      expect(keys(MESSAGES[locale]).sort()).toEqual(source);
    },
  );

  it.each(SUPPORTED_LOCALES.filter((l) => l !== 'it'))(
    '%s uses the same {{placeholders}} as Italian',
    (locale) => {
      expect(placeholders(MESSAGES[locale])).toEqual(placeholders(MESSAGES.it));
    },
  );

  it.each(SUPPORTED_LOCALES)('%s has no empty strings', (locale) => {
    const flat = (o: unknown): string[] =>
      typeof o === 'string' ? [o] : Object.values(o as object).flatMap(flat);
    expect(flat(MESSAGES[locale]).filter((s) => s.trim() === '')).toEqual([]);
  });
});

describe('matchLocale', () => {
  it.each([
    ['de-AT', 'de'],
    ['EN_us', 'en'],
    ['it', 'it'],
    ['fr-CA', 'fr'],
    ['es', null],
    ['', null],
    [null, null],
  ])('%j -> %j', (input, expected) => {
    expect(matchLocale(input)).toBe(expected);
  });
});

describe('resolveLocale', () => {
  it.each([
    ['explicit choice wins', 'fr', ['de-DE'], 'fr'],
    ['first supported device language', 'system', ['es-ES', 'de-DE', 'en-US'], 'de'],
    ['italian when nothing matches', 'system', ['es-ES', 'pt-BR'], 'it'],
    ['italian without device languages', 'system', [], 'it'],
  ] as const)('%s', (_name, preference, device, expected) => {
    expect(resolveLocale(preference, device)).toBe(expected);
  });
});

describe('createI18n', () => {
  it('translates in every locale and falls back to Italian', () => {
    expect(createI18n('it').t('nav.settings')).toBe('Impostazioni');
    expect(createI18n('en').t('nav.settings')).toBe('Settings');
    expect(createI18n('de').t('nav.settings')).toBe('Einstellungen');
    expect(createI18n('fr').t('nav.settings')).toBe('Réglages');
    expect(createI18n('en').t('pair.progress', { target: 'lido.it' })).toBe(
      'Connecting to lido.it',
    );
  });
});
