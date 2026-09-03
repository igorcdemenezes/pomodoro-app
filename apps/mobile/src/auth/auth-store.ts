import { create } from 'zustand';

import { clearTokens, readTokens, writeTokens } from './auth-storage';
import type { AuthResponse, UserProfile } from './auth-types';

export type AuthStatus = 'hydrating' | 'signedIn' | 'signedOut';

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;

  /** Reads the keystore once at launch, so a returning user is not asked to sign in again. */
  hydrate: () => Promise<void>;
  adopt: (session: AuthResponse) => Promise<void>;
  /** Replaces the token pair after a rotation, leaving the profile untouched. */
  rotate: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;
  setUser: (user: UserProfile) => void;
  reset: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'hydrating',
  accessToken: null,
  refreshToken: null,
  user: null,

  hydrate: async () => {
    const tokens = await readTokens();

    if (!tokens) {
      set({ status: 'signedOut', accessToken: null, refreshToken: null, user: null });
      return;
    }

    // The profile is fetched by the app once mounted; the stored tokens are
    // enough to consider the user signed in and get past the splash.
    set({ status: 'signedIn', ...tokens });
  },

  adopt: async (session) => {
    await writeTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });

    set({
      status: 'signedIn',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
    });
  },

  rotate: async (tokens) => {
    await writeTokens(tokens);

    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  },

  setUser: (user) => set({ user }),

  reset: async () => {
    await clearTokens();

    set({ status: 'signedOut', accessToken: null, refreshToken: null, user: null });
  },
}));

/** Read outside React, by the HTTP layer, which has no hooks available. */
export const authSnapshot = () => useAuthStore.getState();
