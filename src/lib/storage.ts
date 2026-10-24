// Key-value storage abstraction. The app uses the device keychain/keystore
// (expo-secure-store) for everything it persists in Phase 0: the device token
// must never land in plain storage, and the few preferences are tiny. Tests
// use the in-memory implementation; nothing else imports expo-secure-store.
import * as SecureStore from 'expo-secure-store';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

/**
 * Keychain (iOS) / Keystore-encrypted storage (Android). AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:
 * readable after the first unlock (future background refresh), never migrated
 * to another device through a backup (the token is bound to this device).
 */
export function createSecureKeyValueStore(): KeyValueStore {
  const options: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  };
  return {
    getItem: (key) => SecureStore.getItemAsync(key, options),
    setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
    deleteItem: (key) => SecureStore.deleteItemAsync(key, options),
  };
}

/** In-memory store for tests and previews. */
export function createMemoryKeyValueStore(initial: Record<string, string> = {}): KeyValueStore & {
  snapshot(): Record<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    deleteItem: async (key) => {
      data.delete(key);
    },
    snapshot: () => Object.fromEntries(data),
  };
}
