// Native side of the optional push notifications (spec 03, core ADR 0027),
// injected through Dependencies so that screens and tests never touch the
// native module. Only three things are used: the system permission, the
// NATIVE device token (APNs on iOS, FCM on Android) and its renewals.
// Never the Expo push service: neither the Expo push token nor the module's
// automatic server registration is used anywhere (push.test.ts guards it),
// so the token goes only to the paired instance (privacy ADR 0005).
import { Platform } from 'react-native';

import type { PushEnvironment } from '@/api/push-adapter';
import { errorKind } from '@/lib/log';

export type PushPermission = 'granted' | 'denied' | 'undetermined';

/**
 * APNs environment of the token. It must match the `aps-environment`
 * entitlement written by the expo-notifications plugin (`mode` in app.json,
 * kept equal by a test): production builds only.
 */
export const PUSH_ENVIRONMENT: PushEnvironment = 'production';

/** Android notification channel of the instance's notifications. */
export const PUSH_CHANNEL_ID = 'arenile';

export interface PushNative {
  /** The current system permission, without asking. */
  permission(): Promise<PushPermission>;
  /** Asks the system permission (prompts once; then the user decides in the settings). */
  requestPermission(channelName: string): Promise<PushPermission>;
  /** The native APNs / FCM token of this app installation. */
  deviceToken(): Promise<string>;
  /** Renewals of the native token decided by the OS; returns the unsubscribe function. */
  onTokenChange(listener: (token: string) => void): () => void;
  environment: PushEnvironment;
}

type NotificationsModule = typeof import('expo-notifications');

function toPermission(status: { granted: boolean; canAskAgain: boolean; status: string }) {
  if (status.granted) return 'granted';
  return status.status === 'undetermined' && status.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Native push for iOS and Android. The module is loaded lazily: it is only
 * needed once the user turns notifications on, and Expo Go or a build
 * without it must keep working. Undefined on other platforms.
 */
export function createExpoPushNative(
  load: () => NotificationsModule = loadNotifications,
  os: string = Platform.OS,
): PushNative | undefined {
  if (os !== 'ios' && os !== 'android') return undefined;
  let mod: NotificationsModule | undefined;
  const get = () => (mod ??= load());
  return {
    environment: PUSH_ENVIRONMENT,
    async permission() {
      return toPermission(await get().getPermissionsAsync());
    },
    async requestPermission(channelName) {
      const n = get();
      // Android 13+: the prompt appears only once a channel exists.
      if (os === 'android') {
        await n.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
          name: channelName,
          importance: n.AndroidImportance.DEFAULT,
        });
      }
      return toPermission(
        await n.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: false, allowSound: true },
        }),
      );
    },
    async deviceToken() {
      const token = await get().getDevicePushTokenAsync();
      if (typeof token.data !== 'string') throw new Error('push: unexpected token type');
      return token.data;
    },
    onTokenChange(listener) {
      try {
        const sub = get().addPushTokenListener((token) => {
          if (typeof token.data === 'string') listener(token.data);
        });
        return () => sub.remove();
      } catch (e) {
        console.warn('push: token listener not available', errorKind(e));
        return () => {};
      }
    },
  };
}

function loadNotifications(): NotificationsModule {
  // Lazy on purpose (see above): a static import would load the native module at start.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as NotificationsModule;
}
