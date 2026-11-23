import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerRequest,
} from '@nestjs/throttler';
import { LOGIN_USERNAME_THROTTLER } from '@/auth/auth.constants';

/**
 * Rate limit for POST /auth/login. The "ip" throttler counts tries per IP; the
 * "username" throttler counts tries per lowercased username, so one locked-out
 * username doesn't block others on the same IP. Over either limit is 429
 * `TOO_MANY_ATTEMPTS` with `retryAfterSec` (and the standard `Retry-After` header).
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  /**
   * Tracks the "username" throttler by the lowercased typed username, so case
   * variants share one counter; others by IP as usual.
   */
  protected override handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    if (requestProps.throttler.name !== LOGIN_USERNAME_THROTTLER) {
      return super.handleRequest(requestProps);
    }
    const username = this.readUsername(requestProps.context);
    // No string username: validation answers 400, nothing to count against.
    if (username === null) return Promise.resolve(true);
    return super.handleRequest({
      ...requestProps,
      getTracker: () => username.toLowerCase(),
    });
  }

  /** Throws the API's error shape instead of Nest's plain "Too Many Requests". */
  protected override throwThrottlingException(
    context: ExecutionContext,
    { timeToBlockExpire }: ThrottlerLimitDetail,
  ): Promise<void> {
    const { res } = this.getRequestResponse(context);
    this.setResponseHeader(res, 'Retry-After', timeToBlockExpire);
    throw new HttpException(
      {
        code: AUTH_ERROR_CODE.TOO_MANY_ATTEMPTS,
        message: 'Too many sign-in tries. Wait and try again.',
        retryAfterSec: timeToBlockExpire,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /** The `username` from the request body, or null when it is missing or not a string. */
  private readUsername(context: ExecutionContext): string | null {
    const { req } = this.getRequestResponse(context);
    const { username } = (req['body'] ?? {}) as { username?: unknown };
    return typeof username === 'string' ? username : null;
  }
}
