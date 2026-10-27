import { useEffect, useState } from 'react';
import { Dimensions, useWindowDimensions, type ScaledSize } from 'react-native';

import { useDependencies, type FormFactor } from '@/providers/dependencies';

/**
 * Smallest window side, in dp, from which the app uses the tablet layout
 * (master/detail split). Android's tablet threshold; every iPad passes it
 * in full screen, an iPad in Slide Over or a narrow Split View does not and
 * gets the phone layout, as it should.
 */
export const TABLET_MIN_SIDE = 600;

export type DeviceLayout = 'phone' | 'tablet';

export function layoutFor(width: number, height: number): DeviceLayout {
  return Math.min(width, height) >= TABLET_MIN_SIDE ? 'tablet' : 'phone';
}

/** Current layout class, updated on rotation and multitasking resizes. */
export function useDeviceLayout(): DeviceLayout {
  const { width, height } = useWindowDimensions();
  return layoutFor(width, height);
}

/**
 * Hardware class for the orientation lock (ADR 0016): the injected one, but
 * a phone whose screen (not window: split screen does not count) reaches the
 * tablet size is a tablet. Android computes the device type once at launch,
 * so a foldable started folded would stay locked once unfolded.
 */
export function useFormFactor(): FormFactor {
  const { formFactor } = useDependencies();
  const [screen, setScreen] = useState(() => Dimensions.get('screen'));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ screen: next }: { screen: ScaledSize }) =>
      setScreen(next),
    );
    return () => sub.remove();
  }, []);
  if (formFactor === 'phone' && Math.min(screen.width, screen.height) >= TABLET_MIN_SIDE) {
    return 'tablet';
  }
  return formFactor;
}
