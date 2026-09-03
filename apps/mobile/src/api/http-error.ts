/**
 * A failure the UI can act on.
 *
 * The API answers with a stable `code` alongside a presentable `message`, so
 * screens branch on the code and show the message rather than parsing prose.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  /** No response at all: airplane mode, wrong address, backend not running. */
  static offline(cause?: unknown): HttpError {
    return new HttpError(0, 'NETWORK_UNREACHABLE', 'Could not reach the server.', cause);
  }

  get isOffline(): boolean {
    return this.status === 0;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

interface ApiErrorBody {
  code?: string;
  message?: string | string[];
  details?: unknown;
}

export async function toHttpError(response: Response): Promise<HttpError> {
  let body: ApiErrorBody = {};

  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // A proxy or a crash can answer with something that is not JSON.
  }

  // Validation failures arrive as an array of messages; the first one is the
  // most specific and the only one worth putting in front of a user.
  const message = Array.isArray(body.message) ? body.message[0] : body.message;

  return new HttpError(
    response.status,
    body.code ?? `HTTP_${response.status}`,
    message ?? 'Something went wrong.',
    body.details,
  );
}
