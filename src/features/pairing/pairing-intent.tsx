// Hands the pairing target from the in-app scanner and manual form to the
// pairing screen in memory. Route parameters are reserved for links opened
// from outside the app (`arenile://pair?d=…`), which always need an explicit
// confirmation: any web page, app or NFC tag can open such a link.
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';

import type { TargetResult } from './target';

interface PairingIntent {
  /** Records the target chosen in the app, right before navigating to /pair. */
  set(target: TargetResult): void;
  /** The target chosen in the app, if any (not consumed). */
  peek(): TargetResult | null;
  clear(): void;
}

const PairingIntentContext = createContext<PairingIntent | null>(null);

export function PairingIntentProvider({ children }: { children: ReactNode }) {
  const current = useRef<TargetResult | null>(null);
  const value = useMemo<PairingIntent>(
    () => ({
      set: (target) => {
        current.current = target;
      },
      peek: () => current.current,
      clear: () => {
        current.current = null;
      },
    }),
    [],
  );
  return <PairingIntentContext.Provider value={value}>{children}</PairingIntentContext.Provider>;
}

export function usePairingIntent(): PairingIntent {
  const ctx = useContext(PairingIntentContext);
  if (!ctx) throw new Error('usePairingIntent outside PairingIntentProvider');
  return ctx;
}
