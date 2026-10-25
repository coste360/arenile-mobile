// Renders the real routes, providers and navigator with fake dependencies:
// in-memory keychain, fake fetch, fixed clock and a chosen window size.
import { renderRouter, screen } from 'expo-router/testing-library';
import { Dimensions } from 'react-native';

import ConnectedLayout from '@/app/(connected)/_layout';
import HomeScreen from '@/app/(connected)/home';
import SettingsScreen from '@/app/(connected)/settings';
import ConnectScreen from '@/app/connect';
import Index from '@/app/index';
import ManualScreen from '@/app/manual';
import PairScreen from '@/app/pair';
import ScanScreen from '@/app/scan';
import { RootNavigator } from '@/components/root-navigator';
import { PREFERENCES_KEY, type Preferences } from '@/features/preferences/preferences';
import { SESSION_KEY, type Session } from '@/features/session/session';
import { fixedClock } from '@/lib/clock';
import { createMemoryKeyValueStore } from '@/lib/storage';
import { AppProviders } from '@/providers/app-providers';
import type { Dependencies } from '@/providers/dependencies';

import { fakeFetch, fakePinnedFetch, type Handler } from './fake-fetch';

export const WINDOWS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 1024, height: 1366 },
} as const;

export type WindowSize = keyof typeof WINDOWS;

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function setWindow(size: WindowSize) {
  const { width, height } = WINDOWS[size];
  const dims = { width, height, scale: 2, fontScale: 1 };
  Dimensions.set({ window: dims, screen: dims });
}

export interface RenderAppOptions {
  initialUrl?: string;
  session?: Session;
  preferences?: Preferences;
  routes?: Record<string, Handler>;
  size?: WindowSize;
  /** Number of keychain writes that fail before the keychain works again. */
  keychainWriteFailures?: number;
  /**
   * Certificate fingerprint of the desktop LAN server answering `routes`:
   * gives the app a fake pinned transport. Omitted: the build has none.
   */
  lanServerFingerprint?: string;
}

export async function renderApp({
  initialUrl = '/',
  session,
  preferences,
  routes = {},
  size = 'phone',
  keychainWriteFailures = 0,
  lanServerFingerprint,
}: RenderAppOptions = {}) {
  setWindow(size);
  const kv = createMemoryKeyValueStore({
    ...(session ? { [SESSION_KEY]: JSON.stringify(session) } : {}),
    ...(preferences ? { [PREFERENCES_KEY]: JSON.stringify(preferences) } : {}),
  });
  let failures = keychainWriteFailures;
  const setItem = kv.setItem;
  kv.setItem = (key, value) => {
    if (failures > 0) {
      failures -= 1;
      return Promise.reject(new Error('keychain unavailable'));
    }
    return setItem(key, value);
  };
  const network = fakeFetch(routes);
  const dependencies: Dependencies = {
    kv,
    clock: fixedClock('2026-10-25T08:00:00Z'),
    fetch: network.fetch,
    pinnedFetch: lanServerFingerprint
      ? fakePinnedFetch(network.fetch, lanServerFingerprint).pinnedFetch
      : null,
    device: { name: 'iPhone di Anna', platform: 'ios' },
    appVersion: '1.0.0',
    deviceLocales: () => ['it-IT'],
    openSystemSettings: jest.fn(),
  };

  function TestRootLayout() {
    return (
      <AppProviders dependencies={dependencies} initialMetrics={METRICS}>
        <RootNavigator />
      </AppProviders>
    );
  }

  const result = await renderRouter(
    {
      _layout: TestRootLayout,
      index: Index,
      connect: ConnectScreen,
      scan: ScanScreen,
      manual: ManualScreen,
      pair: PairScreen,
      '(connected)/_layout': ConnectedLayout,
      '(connected)/home': HomeScreen,
      '(connected)/settings': SettingsScreen,
    },
    { initialUrl },
  );
  return { ...result, kv, network, dependencies, screen };
}

/** "METHOD /path" of every request, in order. */
export const requestsOf = (calls: Request[]) =>
  calls.map((r) => `${r.method} ${new URL(r.url).pathname}`);
