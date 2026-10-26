// Jest setup (jest-expo preset). Unit tests never use the network: every
// HTTP call goes through an injected fetch, and `fetch` itself fails loudly.
beforeEach(() => {
  globalThis.fetch = jest.fn(() => {
    throw new Error('Unexpected network call in a unit test: inject a fake fetch instead.');
  }) as unknown as typeof fetch;
});

// The native date picker of Expo UI (SwiftUI / Compose) has no view in Jest:
// a plain view keeps its props, so tests pick a day with
// fireEvent(picker, 'valueChange', event, date).
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { DateTimePicker: (props: object) => createElement(View, props) };
});
