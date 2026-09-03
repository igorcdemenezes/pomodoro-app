import { authSnapshot } from '../auth/auth-store';
import { refresh as refreshSession } from '../auth/auth-api';
import { request } from './http-client';
import type { RequestOptions } from './http-client';
import { HttpError } from './http-error';

/**
 * A request that carries the session and repairs it when the access token has
 * expired.
 *
 * The access token lives fifteen minutes, so expiry during normal use is the
 * common case, not an edge one. A 401 triggers a rotation and the original
 * request is replayed once.
 *
 * The refresh is single-flight. A screen that fires four queries at once would
 * otherwise send four refreshes with the same token; the backend revokes a
 * rotated token on reuse and would end the session on every device — turning an
 * expired access token into a forced sign-out.
 */
let inFlightRefresh: Promise<string> | null = null;

async function rotateOnce(): Promise<string> {
  inFlightRefresh ??= (async () => {
    const { refreshToken, reset, rotate } = authSnapshot();

    if (!refreshToken) throw new HttpError(401, 'NO_SESSION', 'Not signed in.');

    try {
      const session = await refreshSession(refreshToken);

      await rotate({ accessToken: session.accessToken, refreshToken: session.refreshToken });

      return session.accessToken;
    } catch (error) {
      // A refresh token that is expired, revoked or replayed cannot be
      // recovered from. Anything else — no network, a 500 — must not sign the
      // user out, so the session is kept and the error surfaces.
      if (error instanceof HttpError && error.isUnauthorized) await reset();

      throw error;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

export async function authenticatedRequest<T>(
  path: string,
  options: Omit<RequestOptions, 'accessToken'> = {},
): Promise<T> {
  const { accessToken } = authSnapshot();

  if (!accessToken) throw new HttpError(401, 'NO_SESSION', 'Not signed in.');

  try {
    return await request<T>(path, { ...options, accessToken });
  } catch (error) {
    if (!(error instanceof HttpError) || !error.isUnauthorized) throw error;

    const renewed = await rotateOnce();

    return request<T>(path, { ...options, accessToken: renewed });
  }
}

/** Test seam: the module-level promise would otherwise leak between specs. */
export function resetRefreshState(): void {
  inFlightRefresh = null;
}
