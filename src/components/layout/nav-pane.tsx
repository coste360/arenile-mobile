import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import { contentWidth, navFitsBeside, navMode, type NavMode } from './panes';

interface NavPaneState {
  mode: NavMode;
  toggle: () => void;
  close: () => void;
}

const NavPaneContext = createContext<NavPaneState | null>(null);

/**
 * State of the tablet navigation pane, shared by the pane and the ≡ button of
 * every screen header. Expanded by default only when it fits beside the
 * content; a rotation or a resize starts again from that default, so a pane
 * opened in landscape never becomes a drawer covering the screen in portrait.
 */
export function NavPaneProvider({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const fits = navFitsBeside(width);
  const [expanded, setExpanded] = useState(fits);
  // State adjusted while rendering, not in an effect.
  const [fitted, setFitted] = useState(fits);
  if (fitted !== fits) {
    setFitted(fits);
    setExpanded(fits);
  }
  const value = useMemo<NavPaneState>(
    () => ({
      mode: navMode(expanded, width),
      toggle: () => setExpanded((v) => !v),
      close: () => setExpanded(false),
    }),
    [expanded, width],
  );
  return <NavPaneContext.Provider value={value}>{children}</NavPaneContext.Provider>;
}

/** The navigation pane state; null outside the tablet layout (phones). */
export function useNavPane(): NavPaneState | null {
  return useContext(NavPaneContext);
}

/** Width of the screen content: the window minus the navigation beside it. */
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  const pane = useNavPane();
  return contentWidth(width, pane?.mode ?? null);
}
