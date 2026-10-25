// In-memory native push: a scripted permission, a token, and a way to
// simulate a token renewal by the OS.
import type { PushNative, PushPermission } from '@/features/push/native';

export interface FakePush extends PushNative {
  /** Permission requests made, with the Android channel name. */
  requests: string[];
  /** Simulates the OS renewing the native token. */
  renew(token: string): void;
  /** Number of active token listeners. */
  listeners(): number;
}

export function createFakePush({
  permission = 'undetermined',
  answer = 'granted',
  token = 'apns-token-0123456789abcdef',
  tokenError,
}: {
  permission?: PushPermission;
  /** What the system prompt answers. */
  answer?: PushPermission;
  token?: string;
  tokenError?: Error;
} = {}): FakePush {
  let current = permission;
  const requests: string[] = [];
  const subs = new Set<(t: string) => void>();
  return {
    environment: 'production',
    requests,
    permission: () => Promise.resolve(current),
    requestPermission: (channelName) => {
      requests.push(channelName);
      current = answer;
      return Promise.resolve(current);
    },
    deviceToken: () => (tokenError ? Promise.reject(tokenError) : Promise.resolve(token)),
    onTokenChange: (listener) => {
      subs.add(listener);
      return () => subs.delete(listener);
    },
    renew: (t) => subs.forEach((l) => l(t)),
    listeners: () => subs.size,
  };
}
