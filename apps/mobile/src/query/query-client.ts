import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

import { HttpError } from '../api/http-error';

/**
 * Cached query results are persisted, so a cold start with no connection shows
 * the last known data instead of an empty screen. The backend stays the source
 * of truth: everything revalidates as soon as the connection is back.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        // Retrying a rejected request cannot fix it, and retrying a conflict
        // would fight the server's answer instead of showing it.
        if (error instanceof HttpError && !error.isOffline && error.status < 500) return false;

        return failureCount < 2;
      },
    },
    mutations: {
      // Mutations made while offline are replayed on reconnect rather than
      // failing in front of the user.
      networkMode: 'offlineFirst',
      retry: 1,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'pomodoro.query-cache',
  throttleTime: 2000,
});
