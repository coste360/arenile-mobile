// Applies the language and colour scheme preferences and persists changes.
import type { i18n as I18n } from 'i18next';
import { colorScheme } from 'nativewind';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { resolveLocale, type Locale } from '@/i18n';
import { errorKind } from '@/lib/log';

import type {
  LanguagePreference,
  Preferences,
  PreferencesStore,
  ThemePreference,
} from './preferences';

interface PreferencesContextValue {
  preferences: Preferences;
  /** Language in use (resolved from the preference and the device languages). */
  locale: Locale;
  setLanguage(language: LanguagePreference): void;
  setTheme(theme: ThemePreference): void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/** Applies the colour scheme to NativeWind; failures only cost the manual override. */
export function applyColorScheme(theme: ThemePreference) {
  try {
    colorScheme.set(theme);
  } catch (e) {
    console.warn('preferences: colour scheme not applied', errorKind(e));
  }
}

export function PreferencesProvider({
  initial,
  store,
  i18n,
  deviceLocales,
  children,
}: {
  initial: Preferences;
  store: PreferencesStore;
  i18n: I18n;
  deviceLocales: () => string[];
  children: ReactNode;
}) {
  const [preferences, setPreferences] = useState(initial);
  const locale = resolveLocale(preferences.language, deviceLocales());

  useEffect(() => {
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [i18n, locale]);

  useEffect(() => {
    applyColorScheme(preferences.theme);
  }, [preferences.theme]);

  const update = useCallback(
    (patch: Partial<Preferences>) => {
      // The updater stays pure: compute, set, then persist.
      const next = { ...preferences, ...patch };
      setPreferences(next);
      store.save(next).catch((e: unknown) => {
        console.warn('preferences: not saved', errorKind(e));
      });
    },
    [preferences, store],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      locale,
      setLanguage: (language) => update({ language }),
      setTheme: (theme) => update({ theme }),
    }),
    [preferences, locale, update],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences outside PreferencesProvider');
  return ctx;
}
