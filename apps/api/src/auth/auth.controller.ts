import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Cookies } from '@/common/decorators/cookies.decorator';
import { CurrentSession } from '@/common/decorators/current-session.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SkipCredentialSetup } from '@/common/decorators/skip-credential-setup.decorator';
import type { SessionPayload } from '@/sessions/interfaces/session-payload.interface';
import type { SessionUser } from '@/sessions/interfaces/session-user.interface';
import { LoginThrottlerGuard } from '@/common/guards/login-throttler.guard';
import { SessionGuard } from '@/common/guards/session.guard';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from '@/sessions/sessions.constants';
import {
  BASE_COOKIE_OPTIONS,
  GOOGLE_AUTH_COOKIE_PATH,
  GOOGLE_CALLBACK_ERROR_CODES,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_TTL_MS,
} from './auth.constants';
import {
  NEXT_PATH_MAX_LENGTH,
  getSameSitePath,
} from '@repo/lib/auth/next-path';
import { USER_RESPONSE_SCHEMA } from '@/common/swagger/swagger.constants';
import { errorSchema } from '@/common/swagger/swagger.util';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeUsernameDto } from './dto/change-username.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetupCredentialsDto } from './dto/setup-credentials.dto';
import type { UserDto } from './dto/user.dto';
import type { GoogleAuthUrl } from './interfaces/google-auth-url.interface';
import type { GoogleCallbackErrorCode } from './interfaces/google-callback-error-code.interface';
import type { OAuthState } from './interfaces/oauth-state.interface';

/** Sign-in routes: Google OAuth, Credential setup, login, username change, and password change or reset. */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Returns the Google sign-in URL and stores the matching `state` cookie. */
  @Get('google')
  @ApiOperation({
    summary: 'Get the Google sign-in URL',
    description:
      'Call with `credentials: "include"`, then send the browser to `url` ' +
      '(`window.location.href = url`). Sets a short-lived `oauth_state` cookie (CSRF protection) ' +
      'that `GET /auth/google/callback` checks after the user signs in with Google. ' +
      'The cookie path is the browser-visible `/api/auth/google`: call through the web ' +
      "host's `/api` rewrite, not Nest's `/api/v1` directly.",
  })
  @ApiQuery({
    name: 'next',
    required: false,
    description:
      'Where to land after sign-in. Kept only if it is a same-site relative path ' +
      '(one leading `/`, not `//`, no scheme, no backslash or control characters, at most ' +
      `${NEXT_PATH_MAX_LENGTH} characters); anything else is dropped and the User lands on \`/\`.`,
    example: '/problems/1',
  })
  @ApiResponse({
    status: 403,
    description:
      'This browser already has a User session whose Credential setup is not done.',
    schema: errorSchema(AUTH_ERROR_CODE.CREDENTIAL_SETUP_REQUIRED),
  })
  @ApiOkResponse({
    description: 'The Google sign-in URL.',
    schema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: {
          type: 'string',
          example: 'https://accounts.google.com/o/oauth2/v2/auth?…',
        },
      },
    },
  })
  getGoogleAuthUrl(
    @Query('next') next: unknown,
    @Res({ passthrough: true }) res: Response,
  ): GoogleAuthUrl {
    const oauthState: OAuthState = {
      state: randomUUID(),
      next: getSameSitePath(next),
    };
    res.cookie(OAUTH_STATE_COOKIE_NAME, JSON.stringify(oauthState), {
      ...BASE_COOKIE_OPTIONS,
      path: GOOGLE_AUTH_COOKIE_PATH,
      maxAge: OAUTH_STATE_TTL_MS,
    });
    return { url: this.authService.buildGoogleAuthUrl(oauthState.state) };
  }

  /** Google redirects here: checks `state`, signs in, sets the session cookie, returns to `next` or /login on failure. */
  @Get('google/callback')
  @ApiOperation({
    summary: 'Google sign-in callback',
    description:
      'Called by Google, not by the web app. Checks `state` against the `oauth_state` cookie, ' +
      'verifies the Google account (verified email required), creates the user on first login ' +
      'or updates their profile, then sets the httpOnly `ngg.sid` session cookie (7 days) and ' +
      'redirects to the `next` path stored by `GET /auth/google`, or `/`. Never answers with JSON ' +
      'for a sign-in failure: it redirects to `/login?error=<code>` instead. Redirects are relative, ' +
      'so the browser stays on the web host. Register `<web host>/api/auth/google/callback` ' +
      'as the redirect URI in the Google OAuth console.',
  })
  @ApiQuery({
    name: 'code',
    required: false,
    description:
      'One-time authorization code from Google. Missing when the User cancelled at Google.',
  })
  @ApiQuery({
    name: 'state',
    description: 'Must match the `oauth_state` cookie.',
  })
  @ApiResponse({
    status: 302,
    description:
      'Signed in: sets `ngg.sid` and redirects to `next` or `/`. ' +
      'Failed: sets no session and redirects to `/login?error=<code>`, where `<code>` is ' +
      '`LOGIN_EXPIRED` (missing, mismatched or expired state, or a missing or invalid code, ' +
      'e.g. sign-in cancelled at Google), `EMAIL_NOT_VERIFIED` (Google has not verified the email) ' +
      'or `DOMAIN_NOT_ALLOWED` (not an @email.kmutnb.ac.th or @kmutnb.ac.th account).',
    headers: {
      Location: {
        description: '`next`, `/`, or `/login?error=<code>`.',
        schema: { type: 'string', example: '/login?error=DOMAIN_NOT_ALLOWED' },
      },
    },
  })
  async handleGoogleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Cookies(OAUTH_STATE_COOKIE_NAME) rawOAuthState: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: GOOGLE_AUTH_COOKIE_PATH });
    const oauthState = this.readOAuthState(rawOAuthState);
    if (!code || !state || !oauthState || state !== oauthState.state) {
      return this.redirectToLoginError(res, AUTH_ERROR_CODE.LOGIN_EXPIRED);
    }
    let cookieId: string;
    try {
      cookieId = await this.authService.loginWithGoogle(code);
    } catch (error) {
      const errorCode = this.toGoogleCallbackErrorCode(error);
      if (!errorCode) throw error;
      return this.redirectToLoginError(res, errorCode);
    }
    this.setSessionCookie(res, cookieId);
    res.redirect(oauthState.next ?? '/');
  }

  /** First login only: sets the username and password used by POST /auth/login. */
  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @SkipCredentialSetup()
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'Set username and password (first login)',
    description:
      'Signed in, setup not done. Sets the username and password used by `POST /auth/login`. ' +
      'Stores only the bcrypt hash and sets `credentialsSetAt`. Replaces the session: ' +
      'the response sets a new `ngg.sid` and the previous cookie stops working.',
  })
  @ApiOkResponse({ schema: USER_RESPONSE_SCHEMA })
  @ApiResponse({ status: 400, description: 'Body fails validation.' })
  @ApiResponse({
    status: 401,
    description: 'Not signed in.',
    schema: errorSchema(AUTH_ERROR_CODE.NOT_SIGNED_IN),
  })
  @ApiResponse({
    status: 409,
    description: '`USERNAME_TAKEN` or `SETUP_ALREADY_DONE`.',
    schema: errorSchema(AUTH_ERROR_CODE.USERNAME_TAKEN),
  })
  async setupCredentials(
    @CurrentSession() session: SessionPayload,
    @Body() body: SetupCredentialsDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserDto> {
    const { cookieId, user } = await this.authService.setupCredentials(
      session,
      body,
    );
    this.setSessionCookie(res, cookieId);
    return user;
  }

  /** Username + password sign-in; sets the session cookie. */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LoginThrottlerGuard)
  @ApiOperation({
    summary: 'Sign in with username and password',
    description:
      'For returning users who finished setup. Sets the httpOnly `ngg.sid` session cookie. ' +
      'The username must match exactly: different capitals are 401. ' +
      'Rate limit: 5 tries per minute per username (capitals ignored, so case variants share ' +
      'one counter) and 100 tries per minute per IP.',
  })
  @ApiOkResponse({ schema: USER_RESPONSE_SCHEMA })
  @ApiResponse({
    status: 401,
    description: 'Unknown username or wrong password (same error for both).',
    schema: errorSchema(AUTH_ERROR_CODE.INVALID_CREDENTIALS),
  })
  @ApiResponse({
    status: 403,
    description:
      'This browser already has a User session whose Credential setup is not done.',
    schema: errorSchema(AUTH_ERROR_CODE.CREDENTIAL_SETUP_REQUIRED),
  })
  @ApiResponse({
    status: 429,
    description:
      'Too many tries for this username or from this IP. Body includes `retryAfterSec`; ' +
      'the `Retry-After` header carries the same value.',
    schema: errorSchema(AUTH_ERROR_CODE.TOO_MANY_ATTEMPTS, {
      retryAfterSec: { type: 'integer', example: 42 },
    }),
  })
  async loginWithPassword(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserDto> {
    const { cookieId, user } = await this.authService.loginWithPassword(body);
    this.setSessionCookie(res, cookieId);
    return user;
  }

  /** Who am I: the signed-in User, or 401 NOT_SIGNED_IN. */
  @Get('me')
  @SkipCredentialSetup()
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'Who am I',
    description:
      'The signed-in User. Display name, email, avatar and Role are the copies in the session. ' +
      'Username and `credentialsSetAt` are read from the database and are null until Credential setup.',
  })
  @ApiOkResponse({ schema: USER_RESPONSE_SCHEMA })
  @ApiResponse({
    status: 401,
    description: 'Not signed in, or `ngg.sid` is not a current User session.',
    schema: errorSchema(AUTH_ERROR_CODE.NOT_SIGNED_IN),
  })
  getMe(@CurrentUser() sessionUser: SessionUser): Promise<UserDto> {
    return this.authService.getMe(sessionUser);
  }

  /** Changes the signed-in User's username (sign-in handle). The current session stays signed in. */
  @Patch('username')
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'Change username',
    description:
      'Signed in, Credential setup done. Body is the new username (same rules as setup: ' +
      '4–20 chars, `a-z`, `0-9`, `_`; capitals are rejected, not converted). No limit on how often. ' +
      'The old username is free for others at once. Success keeps this session.',
  })
  @ApiOkResponse({ schema: USER_RESPONSE_SCHEMA })
  @ApiResponse({ status: 400, description: 'The username fails the rules.' })
  @ApiResponse({
    status: 401,
    description: 'Not signed in.',
    schema: errorSchema(AUTH_ERROR_CODE.NOT_SIGNED_IN),
  })
  @ApiResponse({
    status: 403,
    description: 'Credential setup is not done.',
    schema: errorSchema(AUTH_ERROR_CODE.CREDENTIAL_SETUP_REQUIRED),
  })
  @ApiResponse({
    status: 409,
    description: 'Another User has that username.',
    schema: errorSchema(AUTH_ERROR_CODE.USERNAME_TAKEN),
  })
  changeUsername(
    @CurrentUser() sessionUser: SessionUser,
    @Body() body: ChangeUsernameDto,
  ): Promise<UserDto> {
    return this.authService.changeUsername(sessionUser, body);
  }

  /** Replaces the password. The current session stays signed in. */
  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'Change password',
    description:
      'Signed in, Credential setup done. Body is the current password and a new one ' +
      '(same length rules as setup). A wrong current password is 401 `INVALID_CREDENTIALS` ' +
      'and the stored password is unchanged. Success keeps this session.',
  })
  @ApiResponse({
    status: 204,
    description: 'Password changed. This session stays signed in.',
  })
  @ApiResponse({
    status: 400,
    description: 'The new password fails the length rules.',
  })
  @ApiResponse({
    status: 401,
    description: 'Not signed in, or the current password is wrong.',
    schema: errorSchema(AUTH_ERROR_CODE.INVALID_CREDENTIALS),
  })
  async changePassword(
    @CurrentUser() sessionUser: SessionUser,
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(sessionUser.id, body);
  }

  /**
   * Sets a new password without the current one, only within 10 minutes of
   * the Google sign-in that started this session.
   */
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'Reset a forgotten password',
    description:
      'Signed in, Credential setup done. Body is the new password (same length rules as setup). ' +
      'Allowed only when this session was started by a Google sign-in less than 10 minutes ago. ' +
      'Otherwise 403 `RECENT_GOOGLE_SIGN_IN_REQUIRED`, including every session started with a password. ' +
      'Success keeps this session.',
  })
  @ApiResponse({
    status: 204,
    description: 'Password reset. This session stays signed in.',
  })
  @ApiResponse({
    status: 400,
    description: 'The new password fails the length rules.',
  })
  @ApiResponse({
    status: 401,
    description: 'Not signed in.',
    schema: errorSchema(AUTH_ERROR_CODE.NOT_SIGNED_IN),
  })
  @ApiResponse({
    status: 403,
    description:
      'This session was not started by a Google sign-in in the last 10 minutes.',
    schema: errorSchema(AUTH_ERROR_CODE.RECENT_GOOGLE_SIGN_IN_REQUIRED),
  })
  async resetPassword(
    @CurrentSession() session: SessionPayload,
    @Body() body: ResetPasswordDto,
  ): Promise<void> {
    await this.authService.resetPassword(session, body);
  }

  /** Deletes the User session and its pointer, and clears only `ngg.sid`. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SkipCredentialSetup()
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'Log out',
    description:
      'Deletes this User session and its pointer, then clears only the `ngg.sid` cookie. ' +
      'The reserved `ngg.exam.sid` cookie is not touched. Works before Credential setup.',
  })
  @ApiResponse({ status: 204, description: 'Signed out.' })
  @ApiResponse({
    status: 401,
    description: 'Not signed in.',
    schema: errorSchema(AUTH_ERROR_CODE.NOT_SIGNED_IN),
  })
  async logout(
    @Cookies(SESSION_COOKIE_NAME) cookieId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(cookieId);
    this.clearSessionCookie(res);
  }

  /** Sends the browser back to the web host's /login page with `errorCode`. */
  private redirectToLoginError(
    res: Response,
    errorCode: GoogleCallbackErrorCode,
  ): void {
    res.redirect(`/login?error=${errorCode}`);
  }

  /** The error's `code` if it is a Google sign-in failure /login can show, otherwise null. */
  private toGoogleCallbackErrorCode(
    error: unknown,
  ): GoogleCallbackErrorCode | null {
    if (!(error instanceof HttpException)) return null;
    const body = error.getResponse() as { code?: string };
    return (
      GOOGLE_CALLBACK_ERROR_CODES.find((code) => code === body.code) ?? null
    );
  }

  /** The `oauth_state` cookie's contents, with `next` re-checked (it came back from the browser), or null when missing or not ours. */
  private readOAuthState(raw: string | undefined): OAuthState | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<OAuthState> | null;
      if (typeof parsed?.state !== 'string') return null;
      return { state: parsed.state, next: getSameSitePath(parsed.next) };
    } catch {
      return null;
    }
  }

  /** Sets the httpOnly session cookie for the whole site. */
  private setSessionCookie(res: Response, cookieId: string): void {
    res.cookie(SESSION_COOKIE_NAME, cookieId, {
      ...BASE_COOKIE_OPTIONS,
      path: '/',
      maxAge: SESSION_TTL_MS,
    });
  }

  /** Clears only the User session cookie. Leaves `ngg.exam.sid` in place. */
  private clearSessionCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE_NAME, {
      ...BASE_COOKIE_OPTIONS,
      path: '/',
    });
  }
}
