// The day picker's calendar on iOS: @expo/ui's DateTimePicker is a SwiftUI
// view, and SwiftUI does not draw inside react-native-screens'
// FullWindowOverlay, where Reusables' AlertDialogContent renders by default.
// jest-expo runs as iOS; FullWindowOverlay is replaced by a marked View.
import { PortalHost } from '@rn-primitives/portal';
import { render } from '@testing-library/react-native';
import { router, type Href } from 'expo-router';
import { act, fireEvent } from 'expo-router/testing-library';
import { Keyboard, Platform } from 'react-native';

import { AlertDialog, AlertDialogContent, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Text } from '@/components/ui/text';
import { OTHER_DAY } from '@/test/day-picker';
import { dayRoutes, EST } from '@/test/day-routes';
import { json } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { mapDocument } from '@/test/map-fixtures';
import { renderApp, type WindowSize } from '@/test/render-app';

jest.mock('react-native-screens', () => {
  const actual = jest.requireActual('react-native-screens');
  const { createElement } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    ...actual,
    FullWindowOverlay: ({ children }: { children?: unknown }) =>
      createElement(View, { testID: 'full-window-overlay' }, children),
  };
});

type Node = { parent: Node | null; props: { testID?: string } };
const insideOverlay = (node: Node) => {
  for (let n = node.parent; n; n = n.parent) {
    if (n.props.testID === 'full-window-overlay') return true;
  }
  return false;
};

async function open(path: string, size: WindowSize) {
  const doc = mapDocument();
  const routes = {
    ...dayRoutes(),
    [`GET ${EST}/maps`]: () => json(200, { items: [doc.map] }),
    [`GET ${EST}/maps/${doc.map.id}`]: () => json(200, doc),
  };
  const app = await renderApp({ session: SESSION, routes, size });
  expect(await app.screen.findByText('Lido Azzurro')).toBeOnTheScreen();
  await act(async () => router.push(path as Href));
  return app;
}

describe('day picker on iOS', () => {
  it('runs as iOS, where the overlay applies', () => {
    expect(Platform.OS).toBe('ios');
  });

  it.each<[string, WindowSize]>([
    ['/bookings', 'phone'],
    ['/bookings', 'tabletPortrait'],
    ['/map', 'phone'],
  ])(
    'opens the calendar of %s outside FullWindowOverlay and dismisses the keyboard (%s)',
    async (path, size) => {
      const dismiss = jest.spyOn(Keyboard, 'dismiss');
      try {
        const { screen } = await open(path, size);
        const other = await screen.findByRole('radio', { name: OTHER_DAY });
        dismiss.mockClear();

        await fireEvent.press(other);

        const calendar = await screen.findByTestId('day-picker-calendar');
        expect(insideOverlay(calendar as unknown as Node)).toBe(false);
        expect(screen.getByText('Scegli il giorno')).toBeOnTheScreen();
        expect(dismiss).toHaveBeenCalledTimes(1);
      } finally {
        dismiss.mockRestore();
      }
    },
  );
});

describe('AlertDialogContent on iOS', () => {
  async function renderDialog(windowOverlay?: boolean) {
    return render(
      <>
        <AlertDialog open onOpenChange={() => {}}>
          <AlertDialogContent windowOverlay={windowOverlay}>
            <AlertDialogTitle>Confermi?</AlertDialogTitle>
            <Text testID="dialog-body">Corpo</Text>
          </AlertDialogContent>
        </AlertDialog>
        <PortalHost />
      </>,
    );
  }

  it('renders inside FullWindowOverlay by default (above native modals)', async () => {
    const { findByTestId } = await renderDialog();
    expect(insideOverlay((await findByTestId('dialog-body')) as unknown as Node)).toBe(true);
  });

  it('renders outside FullWindowOverlay with windowOverlay={false}', async () => {
    const { findByTestId, queryByTestId } = await renderDialog(false);
    expect(insideOverlay((await findByTestId('dialog-body')) as unknown as Node)).toBe(false);
    expect(queryByTestId('full-window-overlay')).toBeNull();
  });
});
