import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Dimensions } from 'react-native';

import { DependenciesProvider, type Dependencies, type FormFactor } from '@/providers/dependencies';

import { useFormFactor } from './use-device-layout';

function setScreen(width: number, height: number) {
  const dims = { width, height, scale: 2, fontScale: 1 };
  Dimensions.set({ window: dims, screen: dims });
}

function render(formFactor: FormFactor) {
  // Only formFactor is read by the hook.
  const deps = { formFactor } as Dependencies;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={deps}>{children}</DependenciesProvider>
  );
  return renderHook(() => useFormFactor(), { wrapper });
}

describe('useFormFactor (ADR 0016)', () => {
  it.each<[FormFactor, number, number, FormFactor]>([
    ['phone', 390, 844, 'phone'],
    ['phone', 844, 390, 'phone'],
    // A foldable started folded, then opened: the device type stays "phone".
    ['phone', 884, 1104, 'tablet'],
    ['tablet', 834, 1194, 'tablet'],
    ['tablet', 390, 844, 'tablet'],
  ])('%s on a %ix%i screen is %s', async (formFactor, width, height, expected) => {
    setScreen(width, height);
    const { result } = await render(formFactor);
    expect(result.current).toBe(expected);
  });

  it('follows the screen when a foldable opens', async () => {
    setScreen(390, 844);
    const { result } = await render('phone');
    expect(result.current).toBe('phone');

    await act(async () => setScreen(884, 1104));

    expect(result.current).toBe('tablet');
  });
});
