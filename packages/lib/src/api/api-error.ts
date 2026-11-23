import type { AuthErrorCode } from '../auth/error-codes.ts';
/** A non-2xx answer from the API. Switch on `code`, never on the message text. */

export class ApiError extends Error {
  /** HTTP status, e.g. 401. */
  readonly status: number;
  /** The body's `code` (e.g. `NOT_SIGNED_IN`), or null when it has none (e.g. a 400 validation error). */
  readonly code: AuthErrorCode | null;
  /** The parsed JSON body, or null when the body was not JSON. Carries extras such as `retryAfterSec`. */
  readonly body: Record<string, unknown> | null;

  constructor(status: number, body: Record<string, unknown> | null) {
    const code =
      typeof body?.['code'] === 'string'
        ? (body['code'] as AuthErrorCode)
        : null;
    super(`API ${status}${code ? ` ${code}` : ''}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
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
