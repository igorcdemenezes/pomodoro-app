import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { HttpError } from '../api/http-error';
import { useAuthStore } from '../auth/auth-store';
import { fetchProfile, updateProfile } from './profile-api';
import type { UpdateProfileInput } from './profile-api';

export const profileKey = ['me'] as const;

/**
 * The signed-in user, from the server.
 *
 * Fetched through the authenticated client on purpose: this is what exercises
 * the token being attached and the refresh rotating without the user noticing.
 * The result is pushed into the auth store because the focus screen reads the
 * default durations from there, with no query of its own.
 */
export function useProfile() {
  const setUser = useAuthStore((state) => state.setUser);

  return useQuery({
    queryKey: profileKey,
    queryFn: async () => {
      const user = await fetchProfile();
      setUser(user);

      return user;
    },
  });
}

export function useProfileMutation() {
  const client = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  const save = useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: (user) => {
      // The response is the whole profile, so the cache is written rather than
      // invalidated: a refetch would only ask for what is already in hand.
      client.setQueryData(profileKey, user);
      setUser(user);
    },
  });

  return {
    save: save.mutateAsync,
    pending: save.isPending,
    saved: save.isSuccess,
    error: asHttpError(save.error),
    reset: () => save.reset(),
  };
}

function asHttpError(error: unknown): HttpError | null {
  if (!error) return null;

  return error instanceof HttpError ? error : HttpError.offline(error);
}
