// Device storage of the offline data (spec 21.2): the cached map and
// bookings of today and tomorrow, and the queue of operations made offline.
// Backed by SQLite (expo-sqlite/kv-store) in the app's private sandbox,
// covered by the platform's data protection; the keychain stays for the
// device token only (it cannot hold this much data). Nothing here leaves
// the device. Tests use createMemoryKeyValueStore from ./storage.
import { SQLiteStorage } from 'expo-sqlite/kv-store';

import type { KeyValueStore } from './storage';

export const OFFLINE_DATABASE = 'arenile-offline.db';

export function createOfflineKeyValueStore(): KeyValueStore {
  const storage = new SQLiteStorage(OFFLINE_DATABASE);
  return {
    getItem: (key) => storage.getItemAsync(key),
    setItem: (key, value) => storage.setItemAsync(key, value),
    deleteItem: async (key) => {
      await storage.removeItemAsync(key);
    },
  };
}
