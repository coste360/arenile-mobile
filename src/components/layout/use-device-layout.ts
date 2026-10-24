import { useWindowDimensions } from 'react-native';

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
