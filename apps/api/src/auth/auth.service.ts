import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client as GoogleOAuthService } from 'google-auth-library';
import { PrismaService } from '@/prisma/prisma.service';
import { SessionUser } from '@/sessions/interfaces/session-user.interface';
import { SessionsService } from '@/sessions/sessions.service';
import { ALLOWED_EMAIL_DOMAIN, GOOGLE_SCOPES } from './auth.constants';
import { GoogleProfile } from './interfaces/google-profile.interface';

/** True if `email` belongs to the allowed university domain (case-insensitive). */
const isAllowedEmail = (email: string): boolean =>
  email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);

/** Google sign-in: builds the consent URL and turns Google's callback into a session. */
@Injectable()
export class AuthService {
  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly prismaService: PrismaService,
    private readonly sessionsService: SessionsService,
  ) {}

  /** Returns the Google consent-screen URL carrying `state`. */
  buildGoogleAuthUrl(state: string): string {
    return this.googleOAuthService.generateAuthUrl({
      scope: GOOGLE_SCOPES,
      state,
      prompt: 'select_account',
      // Hint: Google pre-selects university accounts. Enforced in fetchGoogleProfile.
      hd: ALLOWED_EMAIL_DOMAIN,
    });
  }

  /** Signs in with Google's authorization `code` and returns the new session's cookie id. */
  async loginWithGoogle(code: string): Promise<string> {
    const profile = await this.fetchGoogleProfile(code);
    const user = await this.upsertUser(profile);
    return this.sessionsService.createSession(user);
  }

  /** Exchanges `code` for tokens and reads the verified profile from the ID token. */
  private async fetchGoogleProfile(code: string): Promise<GoogleProfile> {
    const idToken = await this.exchangeCode(code);
    const ticket = await this.googleOAuthService.verifyIdToken({
      idToken,
      audience: process.env['GOOGLE_CLIENT_ID'],
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Google account has no verified email');
    }
    if (!isAllowedEmail(payload.email)) {
      throw new ForbiddenException(
        `Sign in with your @${ALLOWED_EMAIL_DOMAIN} account`,
      );
    }
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      avatarUrl: payload.picture ?? '',
    };
  }

  /** Trades the one-time `code` for Google's ID token. */
  private async exchangeCode(code: string): Promise<string> {
    try {
      const { tokens } = await this.googleOAuthService.getToken(code);
      if (tokens.id_token) return tokens.id_token;
    } catch {
      // Expired, reused or forged code: same answer as a missing token.
    }
    throw new UnauthorizedException('Invalid Google authorization code');
  }

  /** Creates the user on first login, otherwise refreshes their profile and last login. */
  private async upsertUser(profile: GoogleProfile): Promise<SessionUser> {
    const lastLoginAt = new Date();
    return this.prismaService.User.select(
      'id',
      'email',
      'name',
      'avatarUrl',
      'role',
    ).upsert({
      create: { ...profile, lastLoginAt },
      update: {
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        lastLoginAt,
      },
      conflictOn: { googleId: profile.googleId },
    });
  }
}
