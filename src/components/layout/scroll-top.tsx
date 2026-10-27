import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { ScrollViewInstance } from 'react-native';

const ScrollTopContext = createContext<(() => void) | null>(null);

/** The scroll view of `Screen` / `DetailScroll` and the provider that lets its content reset it. */
export function useScrollTop() {
  const ref = useRef<ScrollViewInstance>(null);
  const scrollTop = useCallback(() => ref.current?.scrollTo({ y: 0, animated: false }), []);
  return { ref, scrollTop };
}

export function ScrollTopProvider({
  scrollTop,
  children,
}: {
  scrollTop: () => void;
  children: ReactNode;
}) {
  return <ScrollTopContext.Provider value={scrollTop}>{children}</ScrollTopContext.Provider>;
}

/**
 * Scrolls the enclosing screen back to the top when mounted: an outcome that
 * replaces a long form would otherwise keep the form's offset and open half
 * hidden under the header. Render it inside the outcome.
 */
export function ScrollToTop() {
  const scrollTop = useContext(ScrollTopContext);
  useEffect(() => {
    scrollTop?.();
  }, [scrollTop]);
  return null;
}
