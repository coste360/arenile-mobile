import { act, fireEvent, waitFor, within } from 'expo-router/testing-library';
import { BackHandler } from 'react-native';

import { DEVICE, json, meta, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { renderApp, type WindowSize } from '@/test/render-app';

const ONLINE: Record<string, Handler> = {
  'GET /api/device/v1/self': () => json(200, DEVICE),
  'GET /api/admin/v1/meta': () => json(200, meta()),
  [`GET /api/admin/v1/establishments/${SESSION.establishmentId}`]: () =>
    json(200, { id: SESSION.establishmentId, name: 'Lido Azzurro' }),
};

async function openHome(size: WindowSize) {
  const app = await renderApp({ session: SESSION, routes: ONLINE, size });
  expect(await app.screen.findByText('Anna · Cassiere')).toBeOnTheScreen();
  return app;
}

type Screen = Awaited<ReturnType<typeof openHome>>['screen'];

/** The ≡ button of the visible header. */
const toggleOf = (screen: Screen) =>
  screen.getAllByRole('button', { name: 'Mostra o nascondi il menu' }).at(-1)!;

describe('tablet navigation pane', () => {
  it.each([
    ['tabletPortrait', 'rail', false],
    ['tabletLandscape', 'expanded beside the content', true],
  ] as const)('starts at %s as the %s', async (size, _mode, expanded) => {
    const { screen } = await openHome(size);
    const link = screen.getByRole('link', { name: 'Impostazioni' });
    // The rail keeps the item name as the accessible label, without visible text.
    expect(within(link).queryByText('Impostazioni') !== null).toBe(expanded);
    expect(screen.getAllByRole('link', { name: 'Impostazioni' })).toHaveLength(1);
    expect(toggleOf(screen).props.accessibilityState).toEqual(
      expect.objectContaining({ expanded }),
    );
    expect(screen.queryByRole('button', { name: 'Chiudi il menu' })).toBeNull();
  });

  it('marks the current screen in the pane', async () => {
    const { screen } = await openHome('tabletLandscape');
    expect(screen.getByRole('link', { name: 'Inizio' }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByRole('link', { name: 'Impostazioni' }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it.each<WindowSize>(['tabletPortrait', 'tabletLandscape'])(
    'navigates from a link of the pane (%s)',
    async (size) => {
      const { screen, getPathname } = await openHome(size);
      await fireEvent.press(screen.getByRole('link', { name: 'Impostazioni' }));
      await waitFor(() => expect(getPathname()).toBe('/settings'));
      expect(await screen.findByText('iPhone di Anna')).toBeOnTheScreen();
      expect(screen.getByRole('link', { name: 'Impostazioni' }).props.accessibilityState).toEqual(
        expect.objectContaining({ selected: true }),
      );
    },
  );

  it('collapses the landscape pane to the rail with the ≡ button and expands it again', async () => {
    const { screen } = await openHome('tabletLandscape');
    await fireEvent.press(toggleOf(screen));
    const link = screen.getByRole('link', { name: 'Impostazioni' });
    expect(within(link).queryByText('Impostazioni')).toBeNull();
    expect(toggleOf(screen).props.accessibilityState).toEqual(
      expect.objectContaining({ expanded: false }),
    );
    // Landscape has room beside the content: no drawer, no scrim.
    expect(screen.queryByRole('button', { name: 'Chiudi il menu' })).toBeNull();

    await fireEvent.press(toggleOf(screen));
    expect(
      within(screen.getByRole('link', { name: 'Impostazioni' })).getByText('Impostazioni'),
    ).toBeOnTheScreen();
  });

  it('opens a drawer over the content in portrait and closes it with the scrim', async () => {
    const { screen, getPathname } = await openHome('tabletPortrait');
    await fireEvent.press(toggleOf(screen));

    // The drawer is modal for screen readers: the header, the screen and the
    // rail under it are hidden, its own links (with their labels) remain.
    expect(screen.queryByRole('button', { name: 'Mostra o nascondi il menu' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Mostra o nascondi il menu', includeHiddenElements: true })
        .props.accessibilityState,
    ).toEqual(expect.objectContaining({ expanded: true }));
    const links = screen.getAllByRole('link', { name: 'Impostazioni' });
    expect(links).toHaveLength(1);
    expect(within(links[0]!).getByText('Impostazioni')).toBeOnTheScreen();
    expect(
      screen.getAllByRole('link', { name: 'Impostazioni', includeHiddenElements: true }),
    ).toHaveLength(2);

    await fireEvent.press(screen.getByRole('button', { name: 'Chiudi il menu' }));
    expect(screen.queryByRole('button', { name: 'Chiudi il menu' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Impostazioni' })).toHaveLength(1);
    expect(toggleOf(screen).props.accessibilityState).toEqual(
      expect.objectContaining({ expanded: false }),
    );
    expect(getPathname()).toBe('/home');
  });

  it('closes the portrait drawer with the Android back button, and only the drawer', async () => {
    type Listener = Parameters<typeof BackHandler.addEventListener>[1];
    const listeners: Listener[] = [];
    const spy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((event, listener) => {
        if (event === 'hardwareBackPress') listeners.push(listener);
        return {
          remove: () => {
            listeners.splice(listeners.indexOf(listener), 1);
          },
        };
      });
    try {
      const { screen, getPathname } = await openHome('tabletPortrait');
      // The navigator listens too; the drawer adds its own on top (the latest runs first).
      const baseline = listeners.length;
      await fireEvent.press(toggleOf(screen));
      expect(screen.getByRole('button', { name: 'Chiudi il menu' })).toBeOnTheScreen();
      expect(listeners).toHaveLength(baseline + 1);

      let handled: boolean | null | undefined;
      await act(async () => {
        handled = listeners.at(-1)!({} as Parameters<Listener>[0]);
      });
      expect(handled).toBe(true);
      expect(screen.queryByRole('button', { name: 'Chiudi il menu' })).toBeNull();
      expect(toggleOf(screen).props.accessibilityState).toEqual(
        expect.objectContaining({ expanded: false }),
      );
      expect(getPathname()).toBe('/home');
      // Closed, the back button is the navigator's again.
      expect(listeners).toHaveLength(baseline);
    } finally {
      spy.mockRestore();
    }
  });

  it('hides the content column from screen readers while the drawer is open', async () => {
    const { screen } = await openHome('tabletPortrait');
    expect(screen.getByText('Anna · Cassiere')).toBeOnTheScreen();
    await fireEvent.press(toggleOf(screen));
    expect(screen.queryByText('Anna · Cassiere')).toBeNull();
    expect(screen.getByText('Anna · Cassiere', { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Chiudi il menu' }));
    expect(screen.getByText('Anna · Cassiere')).toBeOnTheScreen();
  });

  it('closes the portrait drawer when an item is chosen', async () => {
    const { screen, getPathname } = await openHome('tabletPortrait');
    await fireEvent.press(toggleOf(screen));
    const drawerLink = screen.getByRole('link', { name: 'Impostazioni' });

    await fireEvent.press(drawerLink);
    await waitFor(() => expect(getPathname()).toBe('/settings'));
    expect(await screen.findByText('iPhone di Anna')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Chiudi il menu' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Impostazioni' })).toHaveLength(1);
  });

  it('has no ≡ button nor pane on phones', async () => {
    const { screen } = await openHome('phone');
    expect(screen.queryByRole('button', { name: 'Mostra o nascondi il menu' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Impostazioni' })).toBeNull();
  });
});
