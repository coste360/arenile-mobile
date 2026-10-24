import { router } from 'expo-router';
import { fireEvent, waitFor } from 'expo-router/testing-library';

import { PREFERENCES_KEY } from '@/features/preferences/preferences';
import { SESSION_KEY } from '@/features/session/session';
import { DEVICE, json, meta, networkDown, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { renderApp, requestsOf, type WindowSize } from '@/test/render-app';

const ONLINE: Record<string, Handler> = {
  'GET /api/device/v1/self': () => json(200, DEVICE),
  'GET /api/admin/v1/meta': () => json(200, meta()),
  [`GET /api/admin/v1/establishments/${SESSION.establishmentId}`]: () =>
    json(200, { id: SESSION.establishmentId, name: 'Lido Azzurro' }),
  'DELETE /api/device/v1/self': () => new Response(null, { status: 204 }),
};

describe('launch with a stored session', () => {
  it.each<WindowSize>(['phone', 'tablet'])(
    'validates the token and shows the home screen on a %s',
    async (size) => {
      const { screen, network, getPathname } = await renderApp({
        session: SESSION,
        routes: ONLINE,
        size,
      });

      expect(await screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
      expect(getPathname()).toBe('/home');
      expect(screen.getByText('Lido Azzurro')).toBeOnTheScreen();
      expect(screen.getByText('Connesso')).toBeOnTheScreen();
      expect(await screen.findByText('1.0.1')).toBeOnTheScreen();
      expect(screen.getByText('https://lido.example.it')).toBeOnTheScreen();
      expect(requestsOf(network.calls)).toEqual(
        expect.arrayContaining(['GET /api/device/v1/self', 'GET /api/admin/v1/meta']),
      );
      const self = network.calls.find((r) => new URL(r.url).pathname === '/api/device/v1/self');
      expect(self?.headers.get('Authorization')).toBe(`Bearer ${SESSION.token}`);
    },
  );

  it.each([
    ['tablet', true],
    ['phone', false],
  ] as const)('shows the master/detail navigation pane on a %s: %s', async (size, pane) => {
    const { screen } = await renderApp({ session: SESSION, routes: ONLINE, size });

    expect(await screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: 'Impostazioni' }) !== null).toBe(pane);
  });

  it('signs out and explains when the token was revoked (401)', async () => {
    const { screen, kv, getPathname } = await renderApp({
      session: SESSION,
      routes: { ...ONLINE, 'GET /api/device/v1/self': () => problem(401, 'unauthorized') },
    });

    expect(await screen.findByText('Dispositivo scollegato')).toBeOnTheScreen();
    expect(screen.getByText(/revocato dal pannello/)).toBeOnTheScreen();
    expect(getPathname()).toBe('/connect');
    await waitFor(() => expect(kv.snapshot()[SESSION_KEY]).toBeUndefined());
  });

  it('keeps the session on a 401 that does not come from Arenile (captive portal)', async () => {
    const { screen, kv } = await renderApp({
      session: SESSION,
      routes: {
        ...ONLINE,
        'GET /api/device/v1/self': () => new Response('<html>Wi-Fi login</html>', { status: 401 }),
      },
    });

    expect(await screen.findByText('Istanza non raggiungibile')).toBeOnTheScreen();
    expect(kv.snapshot()[SESSION_KEY]).toBeDefined();
  });

  it('keeps the session and says so when the instance is unreachable', async () => {
    const { screen, kv } = await renderApp({
      session: SESSION,
      routes: { 'GET /api/device/v1/self': networkDown, 'GET /api/admin/v1/meta': networkDown },
    });

    expect(
      await screen.findByText('Istanza non raggiungibile', {}, { timeout: 5000 }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Lido Azzurro')).toBeOnTheScreen();
    expect(kv.snapshot()[SESSION_KEY]).toBeDefined();
  });

  it('warns when the instance became too old for the app', async () => {
    const { screen } = await renderApp({
      session: SESSION,
      routes: { ...ONLINE, 'GET /api/admin/v1/meta': () => json(200, meta({ version: '0.9.0' })) },
    });

    expect(await screen.findByText('Arenile da aggiornare')).toBeOnTheScreen();
  });
});

describe('settings', () => {
  it.each<WindowSize>(['phone', 'tablet'])(
    'shows instance and device facts on a %s',
    async (size) => {
      const { screen } = await renderApp({
        initialUrl: '/settings',
        session: SESSION,
        routes: ONLINE,
        size,
      });

      expect(await screen.findByText('Cassiere')).toBeOnTheScreen();
      expect(screen.getByText('https://lido.example.it')).toBeOnTheScreen();
      expect(screen.getByText('iPhone di Anna')).toBeOnTheScreen();
      expect(screen.getByText('1.0.0')).toBeOnTheScreen();
    },
  );

  it('unpairs after confirmation in a dialog', async () => {
    const { screen, kv, network, getPathname } = await renderApp({
      initialUrl: '/settings',
      session: SESSION,
      routes: ONLINE,
    });

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Scollega questo dispositivo' }),
    );
    expect(await screen.findByText('Scollegare questo dispositivo?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Scollega' }));

    expect(
      await screen.findByText('Questo dispositivo non ha più accesso allo stabilimento.'),
    ).toBeOnTheScreen();
    expect(getPathname()).toBe('/connect');
    expect(requestsOf(network.calls)).toContain('DELETE /api/device/v1/self');
    await waitFor(() => expect(kv.snapshot()[SESSION_KEY]).toBeUndefined());
    // The connected area is gone from the history.
    expect(router.canGoBack()).toBe(false);
  });

  it('offers to unpair on this device only when the instance is unreachable', async () => {
    const { screen, kv } = await renderApp({
      initialUrl: '/settings',
      session: SESSION,
      routes: { ...ONLINE, 'DELETE /api/device/v1/self': networkDown },
    });

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Scollega questo dispositivo' }),
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Scollega' }));
    expect(await screen.findByText(/Non è stato possibile avvisare l'istanza/)).toBeOnTheScreen();
    expect(kv.snapshot()[SESSION_KEY]).toBeDefined();

    await fireEvent.press(screen.getByRole('button', { name: 'Scollega solo qui' }));

    expect(await screen.findByText("Collega a un'istanza")).toBeOnTheScreen();
    await waitFor(() => expect(kv.snapshot()[SESSION_KEY]).toBeUndefined());
  });

  it('switches the language and remembers it', async () => {
    const { screen, kv } = await renderApp({
      initialUrl: '/settings',
      session: SESSION,
      routes: ONLINE,
    });

    await fireEvent.press(await screen.findByText('English'));

    expect(await screen.findByText('Disconnect this device')).toBeOnTheScreen();
    await waitFor(() =>
      expect(JSON.parse(kv.snapshot()[PREFERENCES_KEY] ?? '{}')).toEqual({
        language: 'en',
        theme: 'system',
      }),
    );
  });

  it('starts in the stored language', async () => {
    const { screen } = await renderApp({
      session: SESSION,
      routes: ONLINE,
      preferences: { language: 'de', theme: 'system' },
    });

    expect(await screen.findByText('Anna · Kassierer')).toBeOnTheScreen();
  });
});
