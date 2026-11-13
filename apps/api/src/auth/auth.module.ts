import { Module } from '@nestjs/common';
import { OAuth2Client as GoogleOAuthService } from 'google-auth-library';
import { SessionsModule } from '@/sessions/sessions.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/** Google sign-in. Reads GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, WEB_URL. */
@Module({
  imports: [SessionsModule],
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
