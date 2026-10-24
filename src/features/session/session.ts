// The paired session: which instance, which device token, which
// establishment. Persisted only through SessionStore (device keychain).
import type { KeyValueStore } from '@/lib/storage';

export interface Session {
  /** Format version of the stored JSON. */
  v: 1;
  /** scheme://host[:port] of the instance. */
  instanceUrl: string;
  /** Device token (ar_dev_…). Never log it, never show it. */
  token: string;
  /** Pinned certificate fingerprint (desktop LAN mode, ADR 0006). */
  fingerprint?: string;
  deviceId: string;
  deviceName: string;
  /** The token is bound to this establishment (core ADR 0015). */
  establishmentId: string;
  /** Name from the pairing QR or the instance; refreshed when online. */
  establishmentName?: string;
  /** RFC 3339 instant of the pairing. */
  pairedAt: string;
}

export interface SessionStore {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
}

export const SESSION_KEY = 'arenile.session.v1';

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Validates stored JSON; anything unexpected is treated as no session. */
export function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof o !== 'object' || o === null) return null;
  const s = o as Record<string, unknown>;
  if (
    s.v !== 1 ||
    !isString(s.instanceUrl) ||
    !isString(s.token) ||
    !isString(s.deviceId) ||
    !isString(s.deviceName) ||
    !isString(s.establishmentId) ||
    !isString(s.pairedAt) ||
    (s.fingerprint !== undefined && !isString(s.fingerprint)) ||
    (s.establishmentName !== undefined && typeof s.establishmentName !== 'string')
  ) {
    return null;
  }
  return s as unknown as Session;
}

/** SessionStore on a KeyValueStore (the keychain in the app, memory in tests). */
export function createSessionStore(kv: KeyValueStore): SessionStore {
  return {
    async load() {
      const raw = await kv.getItem(SESSION_KEY);
      const session = parseSession(raw);
      // A corrupted or obsolete entry is removed so that it cannot linger.
      if (raw !== null && session === null) await kv.deleteItem(SESSION_KEY);
      return session;
    },
    save: (session) => kv.setItem(SESSION_KEY, JSON.stringify(session)),
    clear: () => kv.deleteItem(SESSION_KEY),
  };
}
