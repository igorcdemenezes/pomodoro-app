import * as SecureStore from 'expo-secure-store';

/**
 * Tokens live in the platform keystore, not in AsyncStorage.
 *
 * AsyncStorage is plain unencrypted files: on a rooted device, or in a backup,
 * a refresh token stored there is readable. SecureStore is backed by the
 * Android Keystore and the iOS Keychain.
 */
const ACCESS_TOKEN_KEY = 'pomodoro.accessToken';
const REFRESH_TOKEN_KEY = 'pomodoro.refreshToken';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export async function readTokens(): Promise<StoredTokens | null> {
  try {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    ]);

    // A half-written pair is unusable: without the refresh token the session
    // cannot survive the access token expiring, so treat it as signed out.
    if (!accessToken || !refreshToken) return null;

    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

export async function writeTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
