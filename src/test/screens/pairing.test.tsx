import { router } from 'expo-router';
import { fireEvent, waitFor } from 'expo-router/testing-library';

import { SESSION_KEY } from '@/features/session/session';
import { DEVICE, json, meta, networkDown, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { renderApp, requestsOf, type RenderAppOptions } from '@/test/render-app';

const d = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString('base64url');
const QR = {
  v: 1,
  url: 'https://lido.example.it',
  code: 'ABCD-EFGH',
  establishment_name: 'Lido Azzurro',
};

const PAIRED_ROUTES: Record<string, Handler> = {
  'GET /api/admin/v1/meta': () => json(200, meta()),
  'POST /api/device/v1/pair': () =>
    json(201, {
      token: 'ar_dev_abcd1234_secret',
      device: DEVICE,
      establishment_id: DEVICE.establishment_id,
    }),
  'GET /api/device/v1/self': () => json(200, DEVICE),
  [`GET /api/admin/v1/establishments/${DEVICE.establishment_id}`]: () =>
    json(200, { id: DEVICE.establishment_id, name: 'Lido Azzurro' }),
};

const posts = (calls: Request[]) =>
  requestsOf(calls).filter((r) => r === 'POST /api/device/v1/pair').length;

/** Opens arenile://pair?d=… as an external link and confirms the instance. */
async function openLink(options: RenderAppOptions & { payload?: unknown }) {
  const app = await renderApp({ initialUrl: `/pair?d=${d(options.payload ?? QR)}`, ...options });
  expect(await app.screen.findByText('Collegare questo dispositivo?')).toBeOnTheScreen();
  await fireEvent.press(app.screen.getByRole('button', { name: 'Collega' }));
  return app;
}

describe('pairing from the link arenile://pair?d=… (system camera, other apps)', () => {
  it('asks to confirm the instance address before any request', async () => {
    const { screen, network } = await renderApp({
      initialUrl: `/pair?d=${d(QR)}`,
      routes: PAIRED_ROUTES,
    });

    expect(await screen.findByText('Collegare questo dispositivo?')).toBeOnTheScreen();
    expect(screen.getByText(/all'istanza lido\.example\.it\./)).toBeOnTheScreen();
    expect(screen.getByText('Stabilimento indicato nel QR: Lido Azzurro')).toBeOnTheScreen();
    expect(network.calls).toHaveLength(0);
  });

  it('goes back to "Collega" without any request when cancelled', async () => {
    const { screen, network, getPathname } = await renderApp({
      initialUrl: `/pair?d=${d(QR)}`,
      routes: PAIRED_ROUTES,
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Annulla' }));

    expect(await screen.findByText("Collega a un'istanza")).toBeOnTheScreen();
    expect(getPathname()).toBe('/connect');
    expect(network.calls).toHaveLength(0);
  });

  it('pairs after confirmation, stores the token in the keychain and opens home', async () => {
    const { screen, kv, network, getPathname } = await openLink({ routes: PAIRED_ROUTES });

    expect(await screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
    expect(getPathname()).toBe('/home');
    expect(JSON.parse(kv.snapshot()[SESSION_KEY] ?? '{}')).toMatchObject({
      instanceUrl: 'https://lido.example.it',
      token: 'ar_dev_abcd1234_secret',
      establishmentName: 'Lido Azzurro',
    });
    expect(requestsOf(network.calls).slice(0, 2)).toEqual([
      'GET /api/admin/v1/meta',
      'POST /api/device/v1/pair',
    ]);
  });

  it('explains that the desktop local network is coming, without any request', async () => {
    const { screen, network } = await renderApp({
      initialUrl: `/pair?d=${d({ ...QR, url: 'https://192.168.1.20:8443', fingerprint: 'AA:BB' })}`,
      routes: PAIRED_ROUTES,
    });

    expect(await screen.findByText('Rete locale del desktop: in arrivo')).toBeOnTheScreen();
    expect(network.calls).toHaveLength(0);
  });

  it.each([
    [
      'invalid or expired code',
      { ...PAIRED_ROUTES, 'POST /api/device/v1/pair': () => problem(400, 'pairing_code_invalid') },
      'Codice non valido',
      'Inquadra un nuovo QR code',
    ],
    [
      'unreachable instance',
      { 'GET /api/admin/v1/meta': networkDown },
      'Istanza non raggiungibile',
      'Riprova',
    ],
    [
      'instance too old',
      { 'GET /api/admin/v1/meta': () => json(200, meta({ version: '0.9.0' })) },
      'Arenile da aggiornare',
      "Torna all'inizio",
    ],
    [
      'app too old',
      {
        'GET /api/admin/v1/meta': () =>
          json(200, meta({ min_client_versions: { mobile: '9.0.0', desktop: '0.1.0' } })),
      },
      "Aggiorna l'app",
      "Torna all'inizio",
    ],
  ])('shows a clear error: %s', async (_name, routes, title, action) => {
    const { screen, kv } = await openLink({ routes });

    expect(await screen.findByText(title)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: action })).toBeOnTheScreen();
    expect(kv.snapshot()[SESSION_KEY]).toBeUndefined();
  });

  it('retries after a network failure', async () => {
    let up = false;
    const { screen, getPathname } = await openLink({
      routes: {
        ...PAIRED_ROUTES,
        'GET /api/admin/v1/meta': (req) => (up ? json(200, meta()) : networkDown(req)),
      },
    });
    expect(await screen.findByText('Istanza non raggiungibile')).toBeOnTheScreen();

    up = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
    expect(getPathname()).toBe('/home');
  });

  it('retries only the keychain save after a keychain failure (the code is single use)', async () => {
    const { screen, network, kv } = await openLink({
      routes: PAIRED_ROUTES,
      keychainWriteFailures: 1,
    });
    expect(await screen.findByText('Accesso non salvato')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
    expect(posts(network.calls)).toBe(1);
    expect(kv.snapshot()[SESSION_KEY]).toBeDefined();
  });

  it('rejects a link that is not a pairing payload', async () => {
    const { screen, network } = await renderApp({ initialUrl: '/pair?d=nope' });

    expect(await screen.findByText('Collegamento non valido')).toBeOnTheScreen();
    expect(network.calls).toHaveLength(0);
  });

  it('ignores address and code passed as link parameters', async () => {
    const { screen, network } = await renderApp({
      initialUrl: '/pair?url=https%3A%2F%2Fevil.example&code=ABCDEFGH',
      routes: PAIRED_ROUTES,
    });

    expect(await screen.findByText('Collegamento non valido')).toBeOnTheScreen();
    expect(network.calls).toHaveLength(0);
  });

  it('refuses to pair over an already paired session', async () => {
    const { screen, network } = await renderApp({
      initialUrl: `/pair?d=${d(QR)}`,
      session: SESSION,
      routes: PAIRED_ROUTES,
    });

    expect(await screen.findByText('Dispositivo già collegato')).toBeOnTheScreen();
    expect(posts(network.calls)).toBe(0);
  });
});

describe('manual pairing form', () => {
  it('validates the fields and pairs with address and code, without confirmation', async () => {
    const { screen, getPathname, network } = await renderApp({
      initialUrl: '/connect',
      routes: PAIRED_ROUTES,
    });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Inserisci indirizzo e codice' }),
    );

    await fireEvent.press(await screen.findByRole('button', { name: 'Collega' }));
    expect(await screen.findByText("Inserisci l'indirizzo dell'istanza.")).toBeOnTheScreen();
    expect(screen.getByText('Il codice ha 8 caratteri, ad esempio ABCD-EFGH.')).toBeOnTheScreen();

    await fireEvent.changeText(
      screen.getByLabelText("Indirizzo dell'istanza"),
      'http://lido.example.it',
    );
    await fireEvent.changeText(screen.getByLabelText('Codice di abbinamento'), 'abcd-efgh');
    await fireEvent.press(screen.getByRole('button', { name: 'Collega' }));
    expect(await screen.findByText(/deve usare https/)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText("Indirizzo dell'istanza"), 'lido.example.it');
    await fireEvent.press(screen.getByRole('button', { name: 'Collega' }));

    expect(await screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
    expect(getPathname()).toBe('/home');
    expect(posts(network.calls)).toBe(1);
    // "Collega" and the form are gone from the history: back never returns to them.
    await waitFor(() => expect(router.canGoBack()).toBe(false));
  });
});
