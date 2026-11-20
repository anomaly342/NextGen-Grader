import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Cookies } from '@/common/decorators/cookies.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SkipCredentialSetup } from '@/common/decorators/skip-credential-setup.decorator';
import type { SessionUser } from '@/sessions/interfaces/session-user.interface';
import { SessionGuard } from '@/common/guards/session.guard';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from '@/sessions/sessions.constants';
import {
  BASE_COOKIE_OPTIONS,
  LOGIN_RATE_LIMIT,
  LOGIN_RATE_TTL_MS,
  GOOGLE_AUTH_PATH,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_TTL_MS,
} from './auth.constants';
import { USER_RESPONSE_SCHEMA } from '@/common/swagger/swagger.constants';
import { errorSchema } from '@/common/swagger/swagger.util';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetupCredentialsDto } from './dto/setup-credentials.dto';
import type { UserDto } from './dto/user.dto';
import type { GoogleAuthUrl } from './interfaces/google-auth-url.interface';

/** Sign-in routes: Google OAuth, Credential setup, login, and password change or reset. */
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
      'that `GET /auth/google/callback` checks after the user signs in with Google.',
  })
  @ApiResponse({
    status: 403,
    description:
      'This browser already has a User session whose Credential setup is not done.',
    schema: errorSchema('CREDENTIAL_SETUP_REQUIRED'),
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
  getGoogleAuthUrl(@Res({ passthrough: true }) res: Response): GoogleAuthUrl {
    const state = randomUUID();
    res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
      ...BASE_COOKIE_OPTIONS,
      path: GOOGLE_AUTH_PATH,
      maxAge: OAUTH_STATE_TTL_MS,
    });
    return { url: this.authService.buildGoogleAuthUrl(state) };
  }

  /** Google redirects here: checks `state`, signs in, sets the session cookie, returns to the web app. */
  @Get('google/callback')
  @ApiOperation({
    summary: 'Google sign-in callback',
    description:
      'Called by Google, not by the web app. Checks `state` against the `oauth_state` cookie, ' +
      'verifies the Google account (verified email required), creates the user on first login ' +
      'or updates their profile, then sets the httpOnly `ngg.sid` session cookie (7 days) and ' +
      'redirects to the web app (`WEB_URL`).',
  })
  @ApiQuery({
    name: 'code',
    description: 'One-time authorization code from Google.',
  })
  @ApiQuery({
    name: 'state',
    description: 'Must match the `oauth_state` cookie.',
  })
  @ApiResponse({
    status: 302,
    description:
      'Signed in: sets the `ngg.sid` cookie and redirects to the web app.',
  })
  @ApiResponse({
    status: 401,
    description:
      'State mismatch or expired, invalid code, or unverified Google email.',
  })
  @ApiResponse({
    status: 403,
    description: 'The Google account is not an @email.kmutnb.ac.th account.',
  })
  async handleGoogleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Cookies(OAUTH_STATE_COOKIE_NAME) expectedState: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: GOOGLE_AUTH_PATH });
    if (!code || !state || state !== expectedState) {
      throw new UnauthorizedException('Invalid or expired login attempt');
    }
    const cookieId = await this.authService.loginWithGoogle(code);
    this.setSessionCookie(res, cookieId);
    res.redirect(process.env['WEB_URL']!);
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
    schema: errorSchema('NOT_SIGNED_IN'),
  })
  @ApiResponse({
    status: 409,
    description: '`USERNAME_TAKEN` or `SETUP_ALREADY_DONE`.',
    schema: errorSchema('USERNAME_TAKEN'),
  })
  async setupCredentials(
    @CurrentUser() sessionUser: SessionUser,
    @Body() body: SetupCredentialsDto,
    @Cookies(SESSION_COOKIE_NAME) cookieId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserDto> {
    if (!cookieId) {
      throw new UnauthorizedException({
        code: 'NOT_SIGNED_IN',
        message: 'Sign in first',
      });
    }
    const { cookieId: nextCookieId, user } =
      await this.authService.setupCredentials(sessionUser.id, body, cookieId);
    this.setSessionCookie(res, nextCookieId);
    return user;
  }

  /** Username + password sign-in; sets the session cookie. */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: LOGIN_RATE_LIMIT, ttl: LOGIN_RATE_TTL_MS } })
  @ApiOperation({
    summary: 'Sign in with username and password',
    description:
      'For returning users who finished setup. Sets the httpOnly `ngg.sid` session cookie. ' +
      'Rate limit: 5 tries per minute per IP.',
  })
  @ApiOkResponse({ schema: USER_RESPONSE_SCHEMA })
  @ApiResponse({
    status: 401,
    description: 'Unknown username or wrong password (same error for both).',
    schema: errorSchema('INVALID_CREDENTIALS'),
  })
  @ApiResponse({
    status: 403,
    description:
      'This browser already has a User session whose Credential setup is not done.',
    schema: errorSchema('CREDENTIAL_SETUP_REQUIRED'),
  })
  @ApiResponse({
    status: 429,
    description: 'Too many failed tries; body includes `retryAfterSec`.',
    schema: errorSchema('TOO_MANY_ATTEMPTS'),
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
    schema: errorSchema('NOT_SIGNED_IN'),
  })
  getMe(@CurrentUser() sessionUser: SessionUser): Promise<UserDto> {
    return this.authService.getMe(sessionUser);
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
    schema: errorSchema('INVALID_CREDENTIALS'),
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
    schema: errorSchema('NOT_SIGNED_IN'),
  })
  @ApiResponse({
    status: 403,
    description:
      'This session was not started by a Google sign-in in the last 10 minutes.',
    schema: errorSchema('RECENT_GOOGLE_SIGN_IN_REQUIRED'),
  })
  async resetPassword(
    @CurrentUser() sessionUser: SessionUser,
    @Cookies(SESSION_COOKIE_NAME) cookieId: string | undefined,
    @Body() body: ResetPasswordDto,
  ): Promise<void> {
    if (!cookieId) {
      throw new UnauthorizedException({
        code: 'NOT_SIGNED_IN',
        message: 'Sign in first',
      });
    }
    await this.authService.resetPassword(sessionUser.id, body, cookieId);
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
    schema: errorSchema('NOT_SIGNED_IN'),
  })
  async logout(
    @Cookies(SESSION_COOKIE_NAME) cookieId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    if (cookieId) await this.authService.logout(cookieId);
    this.clearSessionCookie(res);
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
