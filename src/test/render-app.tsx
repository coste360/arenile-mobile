// Renders the real routes, providers and navigator with fake dependencies:
// in-memory keychain, fake fetch, fixed clock and a chosen window size.
import { renderRouter, screen } from 'expo-router/testing-library';
import { Dimensions } from 'react-native';

import ConnectedLayout from '@/app/(connected)/_layout';
import BookingScreen from '@/app/(connected)/bookings/[bookingId]';
import BookingsScreen from '@/app/(connected)/bookings/index';
import AvailabilityScreen from '@/app/(connected)/availability';
import HomeScreen from '@/app/(connected)/home';
import MapScreen from '@/app/(connected)/map';
import MoveScreen from '@/app/(connected)/move/[bookingId]';
import NewBookingScreen from '@/app/(connected)/new-booking';
import BookingOperationsScreen from '@/app/(connected)/operations/booking/[bookingId]';
import OperationsScreen from '@/app/(connected)/operations/index';
import OperationsScanScreen from '@/app/(connected)/operations/scan';
import SpotOperationsScreen from '@/app/(connected)/operations/spot/[spotId]';
import PendingScreen from '@/app/(connected)/pending';
import ReportsScreen from '@/app/(connected)/reports';
import SaleScreen from '@/app/(connected)/sale';
import SettingsScreen from '@/app/(connected)/settings';
import SpotCalendarScreen from '@/app/(connected)/spot-calendar/[spotId]';
import SpotsScreen from '@/app/(connected)/spots';
import LifeguardScreen from '@/app/(connected)/lifeguard';
import TodayScreen from '@/app/(connected)/today';
import WaitlistEntryScreen from '@/app/(connected)/waitlist/[entryId]';
import WaitlistScreen from '@/app/(connected)/waitlist/index';
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

import { fakeFetch, fakePinnedFetch, type Handler } from './fake-fetch';
import { createFakeWidget } from './fake-widget';
import { sequentialIds } from './ids';

export const WINDOWS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 1024, height: 1366 },
  /** iPad 11" portrait: navigation pane collapsed to the icon rail. */
  tabletPortrait: { width: 834, height: 1194 },
  /** iPad 11" landscape: navigation pane expanded beside the content. */
  tabletLandscape: { width: 1194, height: 834 },
  /** iPad in Split View: still a tablet (short side ≥ 600), but no room for list and detail. */
  tabletSplitView: { width: 678, height: 1032 },
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
  offlineData = {},
  connected = true,
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
  const offlineStore = createMemoryKeyValueStore(offlineData);
  const connectivity = createFakeNetworkMonitor(connected);
  const widget = createFakeWidget();
  const dependencies: Dependencies = {
    kv,
    offlineStore,
    network: connectivity,
    randomId: sequentialIds(),
    clock: fixedClock('2026-10-25T08:00:00Z'),
    fetch: network.fetch,
    pinnedFetch: lanServerFingerprint
      ? fakePinnedFetch(network.fetch, lanServerFingerprint).pinnedFetch
      : null,
    device: { name: 'iPhone di Anna', platform: 'ios' },
    formFactor: size === 'phone' ? 'phone' : 'tablet',
    appVersion: '1.0.0',
    deviceLocales: () => ['it-IT'],
    openSystemSettings: jest.fn(),
    shareText: jest.fn(async () => {}),
    openUrl: jest.fn(async () => {}),
    widget,
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
      '(connected)/map': MapScreen,
      '(connected)/settings': SettingsScreen,
      '(connected)/pending': PendingScreen,
      '(connected)/today': TodayScreen,
      '(connected)/bookings/index': BookingsScreen,
      '(connected)/bookings/[bookingId]': BookingScreen,
      '(connected)/spots': SpotsScreen,
      '(connected)/lifeguard': LifeguardScreen,
      '(connected)/spot-calendar/[spotId]': SpotCalendarScreen,
      '(connected)/operations/index': OperationsScreen,
      '(connected)/operations/scan': OperationsScanScreen,
      '(connected)/operations/booking/[bookingId]': BookingOperationsScreen,
      '(connected)/operations/spot/[spotId]': SpotOperationsScreen,
      '(connected)/reports': ReportsScreen,
      '(connected)/sale': SaleScreen,
      '(connected)/new-booking': NewBookingScreen,
      '(connected)/availability': AvailabilityScreen,
      '(connected)/move/[bookingId]': MoveScreen,
      '(connected)/waitlist/index': WaitlistScreen,
      '(connected)/waitlist/[entryId]': WaitlistEntryScreen,
    },
    { initialUrl },
  );
  return { ...result, kv, offlineStore, connectivity, network, widget, dependencies, screen };
}

/** "METHOD /path" of every request, in order. */
export const requestsOf = (calls: Request[]) =>
  calls.map((r) => `${r.method} ${new URL(r.url).pathname}`);
