// Internationalisation (spec 20): Italian is the source language, English,
// German and French the same translations as the core panel. All four are
// bundled (a few KB). Every user-facing string goes through a key.
import { createInstance, type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import it from './locales/it.json';

export const SUPPORTED_LOCALES = ['it', 'en', 'de', 'fr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const SOURCE_LOCALE: Locale = 'it';
export const NAMESPACE = 'translation';

export type Messages = typeof it;

export const MESSAGES: Record<Locale, Messages> = { it, en, de, fr };

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Normalises a BCP 47 tag ("de-AT") to a supported locale ("de"), if any. */
export function matchLocale(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const base = tag.toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : null;
}

/**
 * Picks the UI language: the user's choice in Settings, then the device
 * languages in order of preference, then Italian (same order as the panel).
 */
export function resolveLocale(
  preference: Locale | 'system',
  deviceTags: readonly string[],
): Locale {
  if (preference !== 'system') return preference;
  for (const tag of deviceTags) {
    const l = matchLocale(tag);
    if (l) return l;
  }
  return SOURCE_LOCALE;
}

/** Creates an isolated, synchronously initialised i18next instance (no global singleton). */
export function createI18n(locale: Locale = SOURCE_LOCALE): I18n {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    lng: locale,
    fallbackLng: SOURCE_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    ns: [NAMESPACE],
    defaultNS: NAMESPACE,
    resources: Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, { [NAMESPACE]: MESSAGES[l] }])),
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
  });
  return instance;
}
