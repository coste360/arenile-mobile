import { orientationFor } from './stack-options';

describe('orientationFor', () => {
  it.each([
    ['phone', 'portrait_up'],
    ['tablet', 'default'],
  ] as const)('%s → %s', (formFactor, orientation) => {
    expect(orientationFor(formFactor)).toBe(orientation);
  });
});
