import { router } from 'expo-router';
import { act, fireEvent, waitFor } from 'expo-router/testing-library';

import type { PushRegistrationStatus } from '@/api/push-adapter';
import type { Role } from '@/api/types';
import { json, problem, type Handler } from '@/test/fake-fetch';
import { createFakePush, type FakePush } from '@/test/fake-push';
import { SESSION } from '@/test/fixtures';
import { phase2Instance, requestsTo } from '@/test/phase-2-routes';
import { renderApp, type WindowSize } from '@/test/render-app';

const PUSH = '/api/device/v1/push';

function status(overrides: Partial<PushRegistrationStatus> = {}): PushRegistrationStatus {
  return {
    available: true,
    relay_configured: true,
    establishment_enabled: true,
    registered: false,
    topics: [],
    allowed_topics: ['booking_new_online', 'booking_approval_requested'],
    ...overrides,
  };
}

/** A fake instance whose push registration follows PUT and DELETE. */
function pushRoutes(initial: PushRegistrationStatus): Record<string, Handler> {
  let current = initial;
  return {
    [`GET ${PUSH}`]: () => json(200, current),
    [`PUT ${PUSH}`]: async (r) => {
      const body = (await r.clone().json()) as { topics: PushRegistrationStatus['topics'] };
      current = { ...current, registered: true, topics: body.topics, locale: 'it' };
      return json(200, current);
    },
    [`DELETE ${PUSH}`]: () => {
      current = { ...current, registered: false, topics: [] };
      return new Response(null, { status: 204 });
    },
  };
}

async function openSettings({
  role = 'manager',
  offered = true,
  push = createFakePush(),
  initial = status(),
  extra = {},
  size = 'phone',
}: {
  role?: Role;
  offered?: boolean;
  /** null: a build without the native module. */
  push?: FakePush | null;
  initial?: PushRegistrationStatus;
  extra?: Record<string, Handler>;
  size?: WindowSize;
} = {}) {
  const instance = phase2Instance({
    role,
    pushNotifications: offered,
    extra: { ...pushRoutes(initial), ...extra },
  });
  const app = await renderApp({
    session: SESSION,
    routes: instance.routes,
    push: push ?? undefined,
    size,
  });
  await app.screen.findByText(/Anna · /);
  await act(async () => router.push('/settings'));
  return { ...app, push };
}

describe('push notifications', () => {
  it.each<WindowSize>(['phone', 'tablet'])(
    'turns on after the system permission, registering the native token (%s)',
    async (size) => {
      const { screen, network, push } = await openSettings({ size });
      expect(await screen.findByText('Spente su questo dispositivo')).toBeOnTheScreen();
      expect(screen.getByText(/mai dati dei clienti/)).toBeOnTheScreen();
      // Nothing is asked or sent before the user decides.
      expect(push!.requests).toEqual([]);
      expect(requestsTo(network.calls, 'PUT', PUSH)).toHaveLength(0);

      await fireEvent.press(screen.getByRole('button', { name: 'Attiva le notifiche' }));
      expect(await screen.findByText('Attive su questo dispositivo')).toBeOnTheScreen();
      expect(push!.requests).toEqual(['Avvisi dello stabilimento']);
      const [put] = requestsTo(network.calls, 'PUT', PUSH);
      expect(put!.headers.get('Authorization')).toMatch(/^Bearer /);
      expect(await put!.json()).toEqual({
        token: 'apns-token-0123456789abcdef',
        environment: 'production',
        locale: 'it',
        topics: ['booking_new_online', 'booking_approval_requested'],
      });
    },
  );

  it('changes the topics and turns off', async () => {
    const { screen, network } = await openSettings({
      push: createFakePush({ permission: 'granted' }),
      initial: status({
        registered: true,
        topics: ['booking_new_online', 'booking_approval_requested'],
      }),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Prenotazioni da approvare' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salva gli avvisi scelti' }));
    await waitFor(() => expect(requestsTo(network.calls, 'PUT', PUSH)).toHaveLength(1));
    expect((await requestsTo(network.calls, 'PUT', PUSH)[0]!.json()).topics).toEqual([
      'booking_new_online',
    ]);

    await fireEvent.press(screen.getByRole('button', { name: 'Disattiva le notifiche' }));
    expect(await screen.findByText('Spente su questo dispositivo')).toBeOnTheScreen();
    expect(requestsTo(network.calls, 'DELETE', PUSH)).toHaveLength(1);
  });

  it('never contacts the instance when the system permission is denied', async () => {
    const { screen, network, dependencies } = await openSettings({
      push: createFakePush({ answer: 'denied' }),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Attiva le notifiche' }));
    expect(
      await screen.findByText(
        'Le notifiche sono bloccate per Arenile nelle impostazioni del telefono.',
      ),
    ).toBeOnTheScreen();
    expect(requestsTo(network.calls, 'PUT', PUSH)).toHaveLength(0);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Apri le impostazioni del telefono' }),
    );
    expect(dependencies.openSystemSettings).toHaveBeenCalled();
  });

  it('explains that the manager has to turn push on in the panel', async () => {
    const { screen } = await openSettings({
      initial: status({ available: false, establishment_enabled: false }),
    });
    expect(await screen.findByText(/Configurazione → Dispositivi/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Attiva le notifiche' })).toBeNull();
  });

  it('shows the push_unavailable refusal', async () => {
    const { screen } = await openSettings({
      extra: { [`PUT ${PUSH}`]: () => problem(409, 'push_unavailable') },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Attiva le notifiche' }));
    expect(
      await screen.findByText("Le notifiche non sono attive sull'istanza o nello stabilimento."),
    ).toBeOnTheScreen();
  });

  it('says so when the phone gives no native token', async () => {
    const { screen, network } = await openSettings({
      push: createFakePush({ permission: 'granted', tokenError: new Error('no entitlement') }),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Attiva le notifiche' }));
    expect(
      await screen.findByText(/Il telefono non ha fornito l'identificativo/),
    ).toBeOnTheScreen();
    expect(requestsTo(network.calls, 'PUT', PUSH)).toHaveLength(0);
  });

  it('registers the renewed token again while registered', async () => {
    const push = createFakePush({ permission: 'granted' });
    const { network } = await openSettings({
      push,
      initial: status({ registered: true, topics: ['booking_new_online'], locale: 'it' }),
    });
    await waitFor(() => expect(push.listeners()).toBe(1));
    await act(async () => push.renew('renewed-token-0123456789'));
    await waitFor(() => expect(requestsTo(network.calls, 'PUT', PUSH)).toHaveLength(1));
    expect(await requestsTo(network.calls, 'PUT', PUSH)[0]!.json()).toEqual({
      token: 'renewed-token-0123456789',
      environment: 'production',
      locale: 'it',
      topics: ['booking_new_online'],
    });
  });

  it.each<[string, { offered: boolean; push?: FakePush | null }]>([
    ['the instance does not offer push', { offered: false }],
    ['the build has no native module', { offered: true, push: null }],
  ])('is hidden when %s, and never calls the push endpoints', async (_name, setup) => {
    const { screen, network } = await openSettings(setup);
    await screen.findByText('Informazioni');
    expect(screen.queryByTestId('push-settings')).toBeNull();
    expect(requestsTo(network.calls, 'GET', PUSH)).toHaveLength(0);
  });
});
