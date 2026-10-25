// Renders the real routes, providers and navigator with fake dependencies:
// in-memory keychain, fake fetch, fixed clock and a chosen window size.
import { renderRouter, screen } from 'expo-router/testing-library';
import { Dimensions } from 'react-native';

import ConnectedLayout from '@/app/(connected)/_layout';
import BookingScreen from '@/app/(connected)/bookings/[bookingId]';
import BookingsScreen from '@/app/(connected)/bookings/index';
import HomeScreen from '@/app/(connected)/home';
import PendingScreen from '@/app/(connected)/pending';
import SettingsScreen from '@/app/(connected)/settings';
import SpotsScreen from '@/app/(connected)/spots';
import TodayScreen from '@/app/(connected)/today';
import ConnectScreen from '@/app/connect';
import Index from '@/app/index';
import ManualScreen from '@/app/manual';
import PairScreen from '@/app/pair';
import ScanScreen from '@/app/scan';
import { RootNavigator } from '@/components/root-navigator';
import { PREFERENCES_KEY, type Preferences } from '@/features/preferences/preferences';
import { SESSION_KEY, type Session } from '@/features/session/session';
import { fixedClock } from '@/lib/clock';
import { createFakeNetworkMonitor } from '@/lib/network';
import { createMemoryKeyValueStore } from '@/lib/storage';
import { AppProviders } from '@/providers/app-providers';
import type { Dependencies } from '@/providers/dependencies';

import { fakeFetch, type Handler } from './fake-fetch';
import { sequentialIds } from './ids';

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
  /** Initial content of the offline store (cached day, operation queue). */
  offlineData?: Record<string, string>;
  /** Device connectivity at start (the returned `connectivity` changes it). */
  connected?: boolean;
}

export async function renderApp({
  initialUrl = '/',
  session,
  preferences,
  routes = {},
  size = 'phone',
  keychainWriteFailures = 0,
  offlineData = {},
  connected = true,
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
  const offlineStore = createMemoryKeyValueStore(offlineData);
  const connectivity = createFakeNetworkMonitor(connected);
  const dependencies: Dependencies = {
    kv,
    offlineStore,
    network: connectivity,
    randomId: sequentialIds(),
    clock: fixedClock('2026-10-25T08:00:00Z'),
    fetch: network.fetch,
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
      '(connected)/pending': PendingScreen,
      '(connected)/today': TodayScreen,
      '(connected)/bookings/index': BookingsScreen,
      '(connected)/bookings/[bookingId]': BookingScreen,
      '(connected)/spots': SpotsScreen,
    },
    { initialUrl },
  );
  return { ...result, kv, offlineStore, connectivity, network, dependencies, screen };
}

/** "METHOD /path" of every request, in order. */
export const requestsOf = (calls: Request[]) =>
  calls.map((r) => `${r.method} ${new URL(r.url).pathname}`);
