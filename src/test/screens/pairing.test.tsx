import { fireEvent, waitFor } from 'expo-router/testing-library';

import { SESSION_KEY } from '@/features/session/session';
import { DEVICE, json, meta, networkDown, problem } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { renderApp, requestsOf } from '@/test/render-app';

const d = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString('base64url');
const QR = {
  v: 1,
  url: 'https://lido.example.it',
  code: 'ABCD-EFGH',
  establishment_name: 'Lido Azzurro',
};

const PAIRED_ROUTES = {
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

describe('pairing from the deep link arenile://pair?d=…', () => {
  it('pairs, stores the token in the keychain and opens the home screen', async () => {
    const { screen, kv, network, getPathname } = await renderApp({
      initialUrl: `/pair?d=${d(QR)}`,
      routes: PAIRED_ROUTES,
    });

    expect(await screen.findByText('Lido Azzurro')).toBeOnTheScreen();
    await waitFor(() => expect(getPathname()).toBe('/home'));
    expect(await screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
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
    const { screen, kv } = await renderApp({ initialUrl: `/pair?d=${d(QR)}`, routes });

    expect(await screen.findByText(title)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: action })).toBeOnTheScreen();
    expect(kv.snapshot()[SESSION_KEY]).toBeUndefined();
  });

  it('retries after a network failure', async () => {
    let up = false;
    const { screen, getPathname } = await renderApp({
      initialUrl: `/pair?d=${d(QR)}`,
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

  it('rejects a link that is not a pairing payload', async () => {
    const { screen, network } = await renderApp({ initialUrl: '/pair?d=nope' });

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
    expect(requestsOf(network.calls)).not.toContain('POST /api/device/v1/pair');
  });
});

describe('manual pairing form', () => {
  it('validates the fields and pairs with address and code', async () => {
    const { screen, getPathname } = await renderApp({
      initialUrl: '/manual',
      routes: PAIRED_ROUTES,
    });

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
  });
});
