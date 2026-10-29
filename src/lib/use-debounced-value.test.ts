import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedValue } from './use-debounced-value';

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns the first value at once and a burst of changes once it settles', async () => {
    const { result, rerender } = await renderHook(
      ({ v }: { v: string }) => useDebouncedValue(v, 300),
      {
        initialProps: { v: 'a' },
      },
    );
    expect(result.current).toBe('a');

    await rerender({ v: 'b' });
    await act(async () => jest.advanceTimersByTime(200));
    await rerender({ v: 'c' });
    await act(async () => jest.advanceTimersByTime(200));
    // 'b' never settled: 'c' came before its 300 ms.
    expect(result.current).toBe('a');

    await act(async () => jest.advanceTimersByTime(100));
    expect(result.current).toBe('c');
  });
});
