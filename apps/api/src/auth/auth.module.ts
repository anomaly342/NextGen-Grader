import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { OAuth2Client as GoogleOAuthService } from 'google-auth-library';
import { BcryptModule } from '@/bcrypt/bcrypt.module';
import { SessionsModule } from '@/sessions/sessions.module';
import { AuthController } from './auth.controller';
import {
  LOGIN_IP_RATE_LIMIT,
  LOGIN_IP_THROTTLER,
  LOGIN_RATE_TTL_MS,
  LOGIN_USERNAME_RATE_LIMIT,
  LOGIN_USERNAME_THROTTLER,
} from './auth.constants';
import { AuthService } from './auth.service';

/**
 * Google sign-in. Reads GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL
 * (`<web host>/api/auth/google/callback`, through the web host's `/api` rewrite).
 */
@Module({
  imports: [
    SessionsModule,
    BcryptModule,
    // Registers the login throttlers. Limits nothing by itself: only routes with
    // @UseGuards(LoginThrottlerGuard) are throttled, and that is POST /auth/login only.
    // The guard tracks the "username" throttler by the typed username, not the IP.
    ThrottlerModule.forRoot([
      {
        name: LOGIN_IP_THROTTLER,
        ttl: LOGIN_RATE_TTL_MS,
        limit: LOGIN_IP_RATE_LIMIT,
      },
      {
        name: LOGIN_USERNAME_THROTTLER,
        ttl: LOGIN_RATE_TTL_MS,
        limit: LOGIN_USERNAME_RATE_LIMIT,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: GoogleOAuthService,
      useFactory: (): GoogleOAuthService =>
        new GoogleOAuthService({
          clientId: process.env['GOOGLE_CLIENT_ID'],
          clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
          redirectUri: process.env['GOOGLE_CALLBACK_URL'],
        }),
    },
  ],
})
export class AuthModule {}
