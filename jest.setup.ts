// Jest setup (jest-expo preset). Unit tests never use the network: every
// HTTP call goes through an injected fetch, and `fetch` itself fails loudly.
beforeEach(() => {
  globalThis.fetch = jest.fn(() => {
    throw new Error('Unexpected network call in a unit test: inject a fake fetch instead.');
  }) as unknown as typeof fetch;
});
