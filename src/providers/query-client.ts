import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

import { NetworkError } from '@/api/errors';
import { OFFLINE_MAX_AGE_MS } from '@/features/offline/persist';

/**
 * Retries only transient network failures; a problem+json answer is final.
 * 401s are handled by SessionProvider (sign-out), never retried. Unused
 * queries are kept as long as the offline cache (48 h): a restored day with
 * no screen observing it must survive until it is shown offline.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => error instanceof NetworkError && failureCount < 2,
        refetchOnReconnect: true,
        gcTime: OFFLINE_MAX_AGE_MS,
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
