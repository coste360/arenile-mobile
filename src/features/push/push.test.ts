import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { NetworkError, ProblemError } from '@/api/errors';
import type { PushTopic } from '@/api/push-adapter';
import { isPushUnavailable } from '@/api/push-adapter';

import { createExpoPushNative, PUSH_CHANNEL_ID, PUSH_ENVIRONMENT } from './native';
import {
  pushBlocker,
  pushErrorKey,
  pushLocale,
  PushPermissionDeniedError,
  toggleTopic,
  topicsToRegister,
} from './push';

const problem = (status: number, type: string) =>
  new ProblemError(status, { type: type as never, title: type, status });

describe('pushLocale', () => {
  it.each([
    ['it', 'it'],
    ['it-IT', 'it'],
    ['en', 'en'],
    ['en-GB', 'en'],
    ['de-CH', 'de'],
    ['fr', 'fr'],
    ['es', 'it'],
  ])('%s → %s', (locale, expected) => {
    expect(pushLocale(locale)).toBe(expected);
  });
});

describe('topicsToRegister', () => {
  const all: PushTopic[] = ['booking_new_online', 'booking_approval_requested', 'payment_failed'];
  it.each<[string, PushTopic[] | undefined, PushTopic[], PushTopic[]]>([
    [
      'no choice yet: every allowed topic',
      undefined,
      ['booking_new_online'],
      ['booking_new_online'],
    ],
    [
      'a choice, in catalogue order',
      ['payment_failed', 'booking_new_online'],
      all,
      ['booking_new_online', 'payment_failed'],
    ],
    ['a topic no longer allowed is dropped', ['payment_failed'], ['booking_new_online'], []],
  ])('%s', (_name, chosen, allowed, expected) => {
    expect(topicsToRegister(chosen, allowed)).toEqual(expected);
  });
});

describe('toggleTopic', () => {
  it('adds and removes, keeping the catalogue order', () => {
    expect(toggleTopic(['payment_failed'], 'booking_new_online')).toEqual([
      'booking_new_online',
      'payment_failed',
    ]);
    expect(toggleTopic(['booking_new_online', 'payment_failed'], 'booking_new_online')).toEqual([
      'payment_failed',
    ]);
  });
});

describe('pushBlocker', () => {
  it.each([
    [false, false, 'relay'],
    [false, true, 'relay'],
    [true, false, 'establishment'],
    [true, true, null],
  ] as const)('relay %p, establishment %p → %p', (relay, est, expected) => {
    expect(pushBlocker({ relay_configured: relay, establishment_enabled: est })).toBe(expected);
  });
});

describe('pushErrorKey', () => {
  it.each<[string, unknown, string]>([
    ['permission denied', new PushPermissionDeniedError(), 'push.errors.permission'],
    ['push_unavailable', problem(409, 'push_unavailable'), 'push.errors.unavailable'],
    ['offline', new NetworkError('unreachable'), 'push.errors.offline'],
    ['403', problem(403, 'forbidden'), 'push.errors.forbidden'],
    ['the OS gave no token', new Error('no aps-environment'), 'push.errors.token'],
    ['other server error', problem(400, 'validation_failed'), 'push.errors.default'],
  ])('%s', (_name, e, key) => {
    expect(pushErrorKey(e)).toBe(key);
  });

  it('recognises the unpinned push_unavailable slug', () => {
    expect(isPushUnavailable(problem(409, 'push_unavailable'))).toBe(true);
    expect(isPushUnavailable(problem(409, 'conflict'))).toBe(false);
  });
});

describe('createExpoPushNative', () => {
  function fakeModule(status = { granted: false, canAskAgain: true, status: 'undetermined' }) {
    const calls: string[] = [];
    let listener: ((t: { type: string; data: unknown }) => void) | undefined;
    const mod = {
      AndroidImportance: { DEFAULT: 3 },
      getPermissionsAsync: jest.fn(async () => status),
      requestPermissionsAsync: jest.fn(async () => {
        calls.push('request');
        return { granted: true, canAskAgain: true, status: 'granted' };
      }),
      setNotificationChannelAsync: jest.fn(async (id: string) => {
        calls.push(`channel:${id}`);
        return null;
      }),
      getDevicePushTokenAsync: jest.fn(async () => ({ type: 'ios', data: 'native-token' })),
      addPushTokenListener: jest.fn((l: typeof listener) => {
        listener = l;
        return { remove: jest.fn() };
      }),
    };
    return { mod, calls, emit: (data: unknown) => listener?.({ type: 'ios', data }) };
  }

  it('exists only on iOS and Android', () => {
    expect(createExpoPushNative(() => ({}) as never, 'web')).toBeUndefined();
    expect(createExpoPushNative(() => ({}) as never, 'ios')).toBeDefined();
  });

  it('never loads the module before it is used', () => {
    const load = jest.fn();
    createExpoPushNative(load as never, 'ios');
    expect(load).not.toHaveBeenCalled();
  });

  it.each([
    [{ granted: true, canAskAgain: true, status: 'granted' }, 'granted'],
    [{ granted: false, canAskAgain: true, status: 'undetermined' }, 'undetermined'],
    [{ granted: false, canAskAgain: false, status: 'denied' }, 'denied'],
    [{ granted: false, canAskAgain: false, status: 'undetermined' }, 'denied'],
  ])('maps the permission %p to %s', async (status, expected) => {
    const { mod } = fakeModule(status);
    expect(await createExpoPushNative(() => mod as never, 'ios')!.permission()).toBe(expected);
  });

  it('creates the Android channel before asking the permission', async () => {
    const { mod, calls } = fakeModule();
    await createExpoPushNative(() => mod as never, 'android')!.requestPermission('Avvisi');
    expect(calls).toEqual([`channel:${PUSH_CHANNEL_ID}`, 'request']);
    expect(mod.setNotificationChannelAsync).toHaveBeenCalledWith(PUSH_CHANNEL_ID, {
      name: 'Avvisi',
      importance: 3,
    });
  });

  it('returns the native token and its renewals', async () => {
    const { mod, emit } = fakeModule();
    const native = createExpoPushNative(() => mod as never, 'ios')!;
    expect(await native.deviceToken()).toBe('native-token');
    const seen: string[] = [];
    native.onTokenChange((t) => seen.push(t));
    emit('renewed-token');
    emit({ endpoint: 'web' });
    expect(seen).toEqual(['renewed-token']);
  });
});

describe('privacy guards', () => {
  const ROOT = join(__dirname, '..', '..');

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === 'generated' ? [] : sources(path);
      return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
    });
  }

  it('never uses the Expo push service', () => {
    const offenders = sources(ROOT).filter((f) =>
      /getExpoPushTokenAsync|setAutoServerRegistrationEnabledAsync|exp\.host/.test(
        readFileSync(f, 'utf8'),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('registers tokens of the APNs environment the build is signed for', () => {
    const app = JSON.parse(readFileSync(join(ROOT, '..', 'app.json'), 'utf8')) as {
      expo: { plugins: (string | [string, Record<string, unknown>])[] };
    };
    const plugin = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-notifications');
    expect(plugin).toEqual([
      'expo-notifications',
      { mode: PUSH_ENVIRONMENT, enableBackgroundRemoteNotifications: false },
    ]);
    expect(app.expo.plugins).toContain('./plugins/with-fcm-privacy');
  });
});
