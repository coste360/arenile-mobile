// Every provider of the app, in one place: dependencies, safe area, server
// state, i18n, preferences (language, theme), session, portal host for the
// Reusables overlays. Renders nothing until the session and the preferences
// are read from the keychain (the splash screen stays up meanwhile).
import { PortalHost } from '@rn-primitives/portal';
import { QueryClientProvider } from '@tanstack/react-query';
import type { i18n as I18n } from 'i18next';
import { useEffect, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import {
  createPreferencesStore,
  DEFAULT_PREFERENCES,
  type Preferences,
} from '@/features/preferences/preferences';
import { PreferencesProvider } from '@/features/preferences/preferences-provider';
import { createSessionStore, type Session } from '@/features/session/session';
import { SessionProvider } from '@/features/session/session-provider';
import { createI18n, resolveLocale } from '@/i18n';

import { DependenciesProvider, type Dependencies } from './dependencies';
import { bindAppStateFocus, createQueryClient } from './query-client';

interface Boot {
  session: Session | null;
  preferences: Preferences;
  i18n: I18n;
}

export function AppProviders({
  dependencies,
  onReady,
  initialMetrics,
  children,
}: {
  dependencies: Dependencies;
  /** Called once the stored state is loaded (hides the splash screen). */
  onReady?: () => void;
  /** Safe-area metrics for tests (no native module). */
  initialMetrics?: Metrics;
  children: ReactNode;
}) {
  const [queryClient] = useState(createQueryClient);
  const [stores] = useState(() => ({
    session: createSessionStore(dependencies.kv),
    preferences: createPreferencesStore(dependencies.kv),
  }));
  const [boot, setBoot] = useState<Boot | null>(null);

  useEffect(() => bindAppStateFocus(), []);

  useEffect(() => {
    let cancelled = false;
    const safely = <T,>(p: Promise<T>, fallback: T) =>
      p.catch((e: unknown) => {
        console.warn('boot: keychain read failed', e instanceof Error ? e.message : e);
        return fallback;
      });
    void Promise.all([
      safely(stores.session.load(), null),
      safely(stores.preferences.load(), DEFAULT_PREFERENCES),
    ]).then(([session, preferences]) => {
      if (cancelled) return;
      const i18n = createI18n(resolveLocale(preferences.language, dependencies.deviceLocales()));
      setBoot({ session, preferences, i18n });
    });
    return () => {
      cancelled = true;
    };
  }, [stores, dependencies]);

  useEffect(() => {
    if (boot) onReady?.();
  }, [boot, onReady]);

  if (!boot) return null;

  return (
    <DependenciesProvider value={dependencies}>
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={boot.i18n}>
            <PreferencesProvider
              initial={boot.preferences}
              store={stores.preferences}
              i18n={boot.i18n}
              deviceLocales={dependencies.deviceLocales}
            >
              <SessionProvider initial={boot.session} store={stores.session}>
                {children}
                <PortalHost />
              </SessionProvider>
            </PreferencesProvider>
          </I18nextProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </DependenciesProvider>
  );
}
