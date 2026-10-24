// User preferences of this device: language and colour scheme. Persisted in
// the same key-value store as the session (no extra storage dependency).
import { isLocale, type Locale } from '@/i18n';
import type { KeyValueStore } from '@/lib/storage';

export type LanguagePreference = Locale | 'system';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Preferences {
  language: LanguagePreference;
  theme: ThemePreference;
}

export const DEFAULT_PREFERENCES: Preferences = { language: 'system', theme: 'system' };

export const PREFERENCES_KEY = 'arenile.preferences.v1';

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

/** Validates stored JSON field by field; unknown values fall back to the defaults. */
export function parsePreferences(raw: string | null): Preferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof Preferences, unknown>>;
    const language =
      o.language === 'system' || (typeof o.language === 'string' && isLocale(o.language))
        ? (o.language as LanguagePreference)
        : DEFAULT_PREFERENCES.language;
    const theme = THEMES.includes(o.theme as ThemePreference)
      ? (o.theme as ThemePreference)
      : DEFAULT_PREFERENCES.theme;
    return { language, theme };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export interface PreferencesStore {
  load(): Promise<Preferences>;
  save(p: Preferences): Promise<void>;
}

export function createPreferencesStore(kv: KeyValueStore): PreferencesStore {
  return {
    load: async () => parsePreferences(await kv.getItem(PREFERENCES_KEY)),
    save: (p) => kv.setItem(PREFERENCES_KEY, JSON.stringify(p)),
  };
}
