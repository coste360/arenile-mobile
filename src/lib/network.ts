// Connectivity of the device, from the operating system (expo-network reads
// the OS state and makes no request of its own). "Connected" only means the
// device has a network: whether the instance answers is learnt from the
// requests themselves (features/offline). `isInternetReachable` is ignored
// on purpose: a desktop instance on the establishment's LAN works without
// internet, and Android would report it unreachable.
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';

export interface NetworkMonitor {
  /** Current state: true connected, false no network, null unknown. */
  current(): Promise<boolean | null>;
  /** Calls `listener` on every change; returns the unsubscribe function. */
  subscribe(listener: (connected: boolean | null) => void): () => void;
}

const connectedOf = (s: NetworkState): boolean | null =>
  typeof s.isConnected === 'boolean' ? s.isConnected : null;

export function createExpoNetworkMonitor(): NetworkMonitor {
  return {
    current: () => getNetworkStateAsync().then(connectedOf),
    subscribe(listener) {
      const sub = addNetworkStateListener((s) => listener(connectedOf(s)));
      return () => sub.remove();
    },
  };
}

/** Controllable monitor for tests and previews. */
export function createFakeNetworkMonitor(initial: boolean | null = true): NetworkMonitor & {
  set(connected: boolean | null): void;
} {
  let state = initial;
  const listeners = new Set<(c: boolean | null) => void>();
  return {
    current: async () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(connected) {
      state = connected;
      for (const l of [...listeners]) l(connected);
    },
  };
}
