import { authenticatedRequest, resetRefreshState } from './authenticated-request';
import { HttpError } from './http-error';
import * as authApi from '../auth/auth-api';
import * as httpClient from './http-client';
import { useAuthStore } from '../auth/auth-store';

jest.mock('./http-client');
jest.mock('../auth/auth-api');
jest.mock('../auth/auth-storage', () => ({
  readTokens: jest.fn(async () => null),
  writeTokens: jest.fn(async () => undefined),
  clearTokens: jest.fn(async () => undefined),
}));

const request = httpClient.request as jest.MockedFunction<typeof httpClient.request>;
const refresh = authApi.refresh as jest.MockedFunction<typeof authApi.refresh>;

const session = (suffix: string) => ({
  accessToken: `access-${suffix}`,
  refreshToken: `refresh-${suffix}`,
  expiresIn: 900,
  user: {
    id: 'user-1',
    email: 'a@example.com',
    name: 'A',
    focusDurationSec: 1500,
    shortBreakSec: 300,
    longBreakSec: 900,
    cyclesUntilLongBreak: 4,
    createdAt: '2026-09-03T00:00:00.000Z',
  },
});

const unauthorized = () => new HttpError(401, 'INVALID_ACCESS_TOKEN', 'expired');

beforeEach(async () => {
  jest.clearAllMocks();
  resetRefreshState();
  await useAuthStore.getState().adopt(session('old'));
});

describe('authenticated requests', () => {
  it('attaches the access token', async () => {
    request.mockResolvedValueOnce({ ok: true });

    await authenticatedRequest('/me');

    expect(request).toHaveBeenCalledWith('/me', { accessToken: 'access-old' });
  });

  it('rotates and replays once when the access token has expired', async () => {
    request.mockRejectedValueOnce(unauthorized()).mockResolvedValueOnce({ ok: true });
    refresh.mockResolvedValueOnce(session('new'));

    const result = await authenticatedRequest('/me');

    expect(result).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenLastCalledWith('/me', { accessToken: 'access-new' });
    expect(useAuthStore.getState().accessToken).toBe('access-new');
  });

  it('refreshes once for concurrent requests that all see a 401', async () => {
    // Four screens firing at once must not send four refreshes: the backend
    // revokes a rotated token on reuse, which would end the session everywhere.
    request.mockImplementation(async (_path, options) => {
      if (options?.accessToken === 'access-old') throw unauthorized();
      return { ok: true };
    });
    refresh.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return session('new');
    });

    const results = await Promise.all([
      authenticatedRequest('/a'),
      authenticatedRequest('/b'),
      authenticatedRequest('/c'),
      authenticatedRequest('/d'),
    ]);

    expect(results).toHaveLength(4);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('signs the user out when the refresh token itself is rejected', async () => {
    request.mockRejectedValueOnce(unauthorized());
    refresh.mockRejectedValueOnce(new HttpError(401, 'REFRESH_TOKEN_REUSED', 'replayed'));

    await expect(authenticatedRequest('/me')).rejects.toBeInstanceOf(HttpError);
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('keeps the session when the refresh fails for any other reason', async () => {
    // A dropped connection or a 500 is not evidence the session is invalid.
    request.mockRejectedValueOnce(unauthorized());
    refresh.mockRejectedValueOnce(HttpError.offline());

    await expect(authenticatedRequest('/me')).rejects.toMatchObject({ status: 0 });
    expect(useAuthStore.getState().status).toBe('signedIn');
  });

  it('does not retry an error that is not a 401', async () => {
    request.mockRejectedValueOnce(new HttpError(409, 'SESSION_ALREADY_ACTIVE', 'conflict'));

    await expect(authenticatedRequest('/sessions/start')).rejects.toMatchObject({ status: 409 });
    expect(refresh).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('refuses to send a request with no session at all', async () => {
    await useAuthStore.getState().reset();

    await expect(authenticatedRequest('/me')).rejects.toMatchObject({ code: 'NO_SESSION' });
    expect(request).not.toHaveBeenCalled();
  });
});
