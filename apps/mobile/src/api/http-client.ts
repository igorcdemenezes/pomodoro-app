import { getApiBaseUrl } from '../config/api-config';
import { HttpError, toHttpError } from './http-error';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Bearer token; omitted for the public endpoints. */
  accessToken?: string;
  signal?: AbortSignal;
  /** Guards against a request hanging when the address points nowhere. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = await getApiBaseUrl();
  const controller = new AbortController();

  // Without a deadline, a wrong address leaves the UI spinning until the OS
  // gives up, which on some devices is well over a minute.
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const forwardAbort = () => controller.abort();
  options.signal?.addEventListener('abort', forwardAbort);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) throw await toHttpError(response);

    // 204 carries no body; parsing it would throw.
    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof HttpError) throw error;

    throw HttpError.offline(error);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', forwardAbort);
  }
}
