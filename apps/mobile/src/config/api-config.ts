import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * Where the API lives.
 *
 * The address is configuration, not a constant. A build ships with a default,
 * and the user can point it somewhere else at runtime — which is what makes one
 * APK usable against a reviewer's own machine, a colleague's host, or a hosted
 * instance, without rebuilding.
 *
 * The default targets 10.0.2.2, the address an Android emulator uses to reach
 * the host it runs on. On a physical device it has to be the host's address on
 * the local network.
 */
const STORAGE_KEY = 'pomodoro.apiBaseUrl';

const FALLBACK_BASE_URL = 'http://10.0.2.2:3000/api/v1';

function configuredDefault(): string {
  const fromManifest = Constants.expoConfig?.extra?.apiBaseUrl;

  return typeof fromManifest === 'string' && fromManifest.length > 0
    ? fromManifest
    : FALLBACK_BASE_URL;
}

let cached: string | null = null;

export async function getApiBaseUrl(): Promise<string> {
  if (cached) return cached;

  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    cached = stored && stored.length > 0 ? stored : configuredDefault();
  } catch {
    // A device that cannot read its own storage should still reach the default
    // rather than fail to start.
    cached = configuredDefault();
  }

  return cached;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  const normalised = normaliseBaseUrl(url);

  cached = normalised;
  await AsyncStorage.setItem(STORAGE_KEY, normalised);
}

export async function resetApiBaseUrl(): Promise<void> {
  cached = configuredDefault();
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** Trailing slashes and a missing scheme are the two mistakes people make here. */
export function normaliseBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');

  // Any scheme is left alone, not just http and https: prefixing `ftp://host`
  // with `http://` would build `http://ftp://host` and let a wrong address pass
  // validation instead of being rejected.
  //
  // The `//` is required, otherwise `localhost:3000` reads as the scheme
  // `localhost:` — which is the single most likely thing someone types here.
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);

  return hasScheme ? trimmed : `http://${trimmed}`;
}

export function isValidBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(normaliseBaseUrl(url));

    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const apiConfigDefaults = { fallback: FALLBACK_BASE_URL, storageKey: STORAGE_KEY };
