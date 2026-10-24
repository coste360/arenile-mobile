import { renderApp, type WindowSize } from '@/test/render-app';

describe('Collega (connect) screen', () => {
  it.each<WindowSize>(['phone', 'tablet'])('renders the two ways to pair on a %s', async (size) => {
    const { screen, getPathname } = await renderApp({ size });

    expect(await screen.findByText("Collega a un'istanza")).toBeOnTheScreen();
    expect(getPathname()).toBe('/connect');
    expect(screen.getByRole('button', { name: 'Inquadra il QR code' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Inserisci indirizzo e codice' })).toBeOnTheScreen();
    expect(screen.getByText(/nessuna telemetria/)).toBeOnTheScreen();
  });

  it('explains a revoked device', async () => {
    const { screen } = await renderApp({ initialUrl: '/connect?reason=revoked' });

    expect(await screen.findByText('Dispositivo scollegato')).toBeOnTheScreen();
    expect(screen.getByText(/revocato dal pannello/)).toBeOnTheScreen();
  });
});
