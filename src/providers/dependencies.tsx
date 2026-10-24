// Composition root of the side effects the app needs: storage, clock,
// network, device facts. Production values come from createDefaultDependencies();
// tests pass in-memory fakes, so no screen touches a native module directly.
import * as Device from 'expo-device';
import { getLocales } from 'expo-localization';
import { createContext, useContext, type ReactNode } from 'react';
import { Linking, Platform } from 'react-native';

import { APP_VERSION } from '@/config/app';
import type { DeviceInfo } from '@/features/pairing/pair';
import { systemClock, type Clock } from '@/lib/clock';
import { createSecureKeyValueStore, type KeyValueStore } from '@/lib/storage';

export interface Dependencies {
  kv: KeyValueStore;
  clock: Clock;
  /** fetch implementation; undefined means the platform fetch. */
  fetch?: typeof fetch;
  device: DeviceInfo;
  /** Version of this app (app.json), sent at pairing and checked against the instance. */
  appVersion: string;
  /** Device languages, most preferred first (BCP 47 tags). */
  deviceLocales: () => string[];
  openSystemSettings: () => void;
}

function platform(): DeviceInfo['platform'] {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'other';
}

export function createDefaultDependencies(): Dependencies {
  return {
    kv: createSecureKeyValueStore(),
    clock: systemClock,
    appVersion: APP_VERSION,
    device: {
      // iOS returns a generic "iPhone"/"iPad" without a special entitlement:
      // fine, the panel shows it next to the user name.
      name: Device.deviceName ?? Device.modelName ?? 'Arenile mobile',
      platform: platform(),
    },
    deviceLocales: () => getLocales().map((l) => l.languageTag),
    openSystemSettings: () => {
      void Linking.openSettings();
    },
  };
}

const DependenciesContext = createContext<Dependencies | null>(null);

export function DependenciesProvider({
  value,
  children,
}: {
  value: Dependencies;
  children: ReactNode;
}) {
  return <DependenciesContext.Provider value={value}>{children}</DependenciesContext.Provider>;
}

export function useDependencies(): Dependencies {
  const deps = useContext(DependenciesContext);
  if (!deps) throw new Error('useDependencies outside DependenciesProvider');
  return deps;
}
