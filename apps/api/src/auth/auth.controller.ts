import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from '@/sessions/sessions.constants';
import {
  BASE_COOKIE_OPTIONS,
  GOOGLE_AUTH_PATH,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_TTL_MS,
} from './auth.constants';
import { AuthService } from './auth.service';
import type { GoogleAuthUrl } from './interfaces/google-auth-url.interface';

/** Google sign-in routes. */
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
      'or updates their profile, then sets the httpOnly `sid` session cookie (7 days) and ' +
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
      'Signed in: sets the `sid` cookie and redirects to the web app.',
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
    res.cookie(SESSION_COOKIE_NAME, cookieId, {
      ...BASE_COOKIE_OPTIONS,
      path: '/',
      maxAge: SESSION_TTL_MS,
    });
    res.redirect(process.env['WEB_URL']!);
  }
}
