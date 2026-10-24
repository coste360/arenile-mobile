import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

import { NetworkError } from '@/api/errors';

/**
 * Retries only transient network failures; a problem+json answer is final.
 * 401s are handled by SessionProvider (sign-out), never retried.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => error instanceof NetworkError && failureCount < 2,
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
    },
  });
}

/** Refetches stale queries when the app comes back to the foreground. */
export function bindAppStateFocus(): () => void {
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      handleFocus(status === 'active');
    });
    return () => sub.remove();
  });
  return () => focusManager.setEventListener(() => () => {});
}
