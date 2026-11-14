import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
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
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
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
import {
  errorSchema,
  USER_RESPONSE_SCHEMA,
} from '@/common/swagger/swagger.constants';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SetupCredentialsDto } from './dto/setup-credentials.dto';
import type { UserDto } from './dto/user.dto';
import type { GoogleAuthUrl } from './interfaces/google-auth-url.interface';

/** Sign-in routes: Google OAuth, first-login setup, username/password login. */
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
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const expectedState = (req.cookies as Record<string, string | undefined>)[
      OAUTH_STATE_COOKIE_NAME
    ];
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
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'Set username and password (first login)',
    description:
      'Signed in, setup not done. Sets the username and password used by `POST /auth/login`. ' +
      'Stores only the bcrypt hash and sets `credentialsSetAt`.',
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
  ): Promise<UserDto> {
    return this.authService.setupCredentials(sessionUser.id, body);
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

  /** Sets the httpOnly session cookie for the whole site. */
  private setSessionCookie(res: Response, cookieId: string): void {
    res.cookie(SESSION_COOKIE_NAME, cookieId, {
      ...BASE_COOKIE_OPTIONS,
      path: '/',
      maxAge: SESSION_TTL_MS,
    });
  }
}
