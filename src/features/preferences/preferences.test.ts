import { createMemoryKeyValueStore } from '@/lib/storage';

import {
  createPreferencesStore,
  DEFAULT_PREFERENCES,
  parsePreferences,
  PREFERENCES_KEY,
} from './preferences';

describe('parsePreferences', () => {
  it.each([
    ['nothing stored', null, DEFAULT_PREFERENCES],
    ['not JSON', 'x', DEFAULT_PREFERENCES],
    ['valid', '{"language":"de","theme":"dark"}', { language: 'de', theme: 'dark' }],
    [
      'system language',
      '{"language":"system","theme":"light"}',
      { language: 'system', theme: 'light' },
    ],
    ['unknown language', '{"language":"es","theme":"dark"}', { language: 'system', theme: 'dark' }],
    ['unknown theme', '{"language":"fr","theme":"sepia"}', { language: 'fr', theme: 'system' }],
  ])('%s', (_name, raw, expected) => {
    expect(parsePreferences(raw)).toEqual(expected);
  });
});

describe('PreferencesStore', () => {
  it('round-trips through the key-value store', async () => {
    const kv = createMemoryKeyValueStore();
    const store = createPreferencesStore(kv);

    await store.save({ language: 'en', theme: 'dark' });

    expect(await store.load()).toEqual({ language: 'en', theme: 'dark' });
    expect(kv.snapshot()[PREFERENCES_KEY]).toBe('{"language":"en","theme":"dark"}');
  });
});
