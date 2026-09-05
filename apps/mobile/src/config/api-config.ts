import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { resetServerClock } from '../api/server-clock';

/**
 * Where the API lives.
 *
 * The address is configuration, not a constant. A build ships with a default,
 * and the user can point it somewhere else at runtime — which is what makes one
 * APK usable against a reviewer's own machine, a colleague's host, or a hosted
 * instance, without rebuilding.
 *
 * The shipped default targets 10.0.2.2, the address an Android emulator uses to
 * reach the host it runs on. On a physical device it means nothing, so in
 * development the address is derived from the dev server instead: the phone
 * loaded the bundle over the local network, and Expo hands that host back as
 * `hostUri`. The API runs on the same machine, so only the port differs — which
 * spares anyone typing an address that changes every time DHCP moves.
 */
const STORAGE_KEY = 'pomodoro.apiBaseUrl';

const FALLBACK_BASE_URL = 'http://10.0.2.2:3000/api/v1';

/** The address baked into the build: the one a release has to rely on. */
function manifestDefault(): string {
  const fromManifest = Constants.expoConfig?.extra?.apiBaseUrl;

  return typeof fromManifest === 'string' && fromManifest.length > 0
    ? fromManifest
    : FALLBACK_BASE_URL;
}

/**
 * The same address with the dev server's host swapped in.
 *
 * Port and path are taken from the configured default rather than repeated
 * here, so the build config stays the one place that decides them. Returns null
 * outside development, where there is no dev server and the shipped address is
 * the only meaningful answer.
 */
export function devServerDefault(hostUri: string | undefined): string | null {
  const host = hostUri?.split(':')[0];

  if (!host) return null;

  try {
    const derived = new URL(normaliseBaseUrl(manifestDefault()));

    derived.hostname = host;

    return normaliseBaseUrl(derived.toString());
  } catch {
    return null;
  }
}

function configuredDefault(): string {
  if (__DEV__) {
    const fromDevServer = devServerDefault(Constants.expoConfig?.hostUri);

    if (fromDevServer) return fromDevServer;
  }

  return manifestDefault();
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
  resetServerClock();
  await AsyncStorage.setItem(STORAGE_KEY, normalised);
}

export async function resetApiBaseUrl(): Promise<void> {
  cached = configuredDefault();
  resetServerClock();
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
