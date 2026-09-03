import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Device from 'expo-device';

import { HttpError } from '../api/http-error';
import * as api from './auth-api';
import { useAuthStore } from './auth-store';

interface Credentials {
  email: string;
  password: string;
}

export function useAuthActions() {
  const client = useQueryClient();
  const adopt = useAuthStore((state) => state.adopt);
  const reset = useAuthStore((state) => state.reset);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const run = useCallback(async (action: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof HttpError ? caught : HttpError.offline(caught));
    } finally {
      setPending(false);
    }
  }, []);

  const signIn = useCallback(
    (credentials: Credentials) =>
      run(async () => {
        const session = await api.login({ ...credentials, deviceLabel: deviceLabel() });
        await adopt(session);
      }),
    [adopt, run],
  );

  const signUp = useCallback(
    (input: Credentials & { name: string }) =>
      run(async () => {
        const session = await api.register(input);
        await adopt(session);
      }),
    [adopt, run],
  );

  const signOut = useCallback(async () => {
    const { refreshToken } = useAuthStore.getState();

    // The local session is cleared regardless. If the network call fails the
    // token stays valid on the server until it expires, but leaving the user
    // signed in on a device they asked to sign out of is the worse outcome.
    try {
      if (refreshToken) await api.logout(refreshToken);
    } catch {
      // Intentionally ignored.
    }

    await reset();
    client.clear();
  }, [client, reset]);

  return { signIn, signUp, signOut, pending, error, clearError: () => setError(null) };
}

/** Labels the session in the backend, so signing out one device is meaningful. */
function deviceLabel(): string {
  const name = Device.deviceName ?? Device.modelName;

  return name ? name.slice(0, 120) : 'Unknown device';
}
