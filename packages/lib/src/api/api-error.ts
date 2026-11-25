import { isAuthErrorCode, type AuthErrorCode } from '../auth/error-codes.ts';

/** A non-2xx answer from the API. Switch on `code`, never on the message text. */
export class ApiError extends Error {
  /** HTTP status, e.g. 401. */
  readonly status: number;
  /** The body's auth error code (e.g. `NOT_SIGNED_IN`), or null when it has none or an unknown one (e.g. a 400 validation error). */
  readonly code: AuthErrorCode | null;
  /** The body's `retryAfterSec` when it is a positive number (sent with `TOO_MANY_ATTEMPTS`), else null. */
  readonly retryAfterSec: number | null;

  constructor(status: number, body: Record<string, unknown> | null) {
    const code = isAuthErrorCode(body?.['code']) ? body['code'] : null;
    super(`API ${status}${code ? ` ${code}` : ''}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSec = getPositiveNumber(body?.['retryAfterSec']);
  }

  /** Builds an ApiError from a failed response, reading its JSON body if it has one. */
  static async fromResponse(res: Response): Promise<ApiError> {
    let body: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = await res.json();
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      // Not JSON (e.g. a proxy error page): no code.
    }
    return new ApiError(res.status, body);
  }
}

/** The failure's auth error code, or null when it has none (not an ApiError, a 5xx, a 400 validation error). */
export function getAuthErrorCode(error: unknown): AuthErrorCode | null {
  return error instanceof ApiError ? error.code : null;
}

/** `value` when it is a positive number, else null. */
function getPositiveNumber(value: unknown): number | null {
  return typeof value === 'number' && value > 0 ? value : null;
}
