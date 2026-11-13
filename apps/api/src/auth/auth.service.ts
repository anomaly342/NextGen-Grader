import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client as GoogleOAuthService } from 'google-auth-library';
import { BcryptService } from '@/bcrypt/bcrypt.service';
import { PrismaService } from '@/prisma/prisma.service';
import { SessionUser } from '@/sessions/interfaces/session-user.interface';
import { SessionsService } from '@/sessions/sessions.service';
import {
  ALLOWED_EMAIL_DOMAIN,
  DUMMY_PASSWORD_HASH,
  GOOGLE_SCOPES,
  PG_UNIQUE_VIOLATION,
  USERNAME_UNIQUE_CONSTRAINT,
} from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { SetupCredentialsDto } from './dto/setup-credentials.dto';
import { GoogleProfile } from './interfaces/google-profile.interface';
import { LoginResult } from './interfaces/login-result.interface';
import { UserDto } from './dto/user.dto';
import { UserDtoRow } from './dto/user-dto-row.dto';

/** Sign-in: Google OAuth, first-login credential setup, and username/password login. */
@Injectable()
export class AuthService {
  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly prismaService: PrismaService,
    private readonly sessionsService: SessionsService,
    private readonly bcryptService: BcryptService,
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

  /**
   * Sets the user's username and password once. The `credentialsSetAt IS NULL`
   * check and the write are one SQL statement, so two requests can't both win.
   */
  async setupCredentials(
    userId: number,
    { username, password }: SetupCredentialsDto,
  ): Promise<UserDto> {
    const passwordHash = await this.bcryptService.hash(password);
    const user = await this.claimCredentials(userId, username, passwordHash);
    if (!user) {
      throw new ConflictException({
        code: 'SETUP_ALREADY_DONE',
        message: 'Username and password are already set',
      });
    }
    return user;
  }

  /**
   * Username + password sign-in. Unknown username and wrong password give the
   * same 401 and take the same time. Rate-limited by the controller (@Throttle).
   */
  async loginWithPassword({
    username,
    password,
  }: LoginDto): Promise<LoginResult> {
    const normalizedUsername = username.toLowerCase();
    const user = await this.prismaService.User.where({
      username: normalizedUsername,
    })
      .select(
        'id',
        'email',
        'name',
        'username',
        'avatarUrl',
        'role',
        'credentialsSetAt',
        'passwordHash',
      )
      .first();
    // Missing user (or no hash yet) still runs bcrypt against a fixed hash, so
    // unknown usernames take the same time as a wrong password.
    const isPasswordValid = await this.bcryptService.verify(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user?.passwordHash || !isPasswordValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Wrong username or password',
      });
    }
    await this.prismaService.User.where({ id: user.id }).update({
      lastLoginAt: new Date(),
    });
    const cookieId = await this.sessionsService.createSession(
      this.toSessionUser(user),
    );
    const { passwordHash: _, ...publicUser } = user;
    return { cookieId, user: publicUser };
  }

  /** Writes the credentials only if not set yet; null if they already were. */
  private async claimCredentials(
    userId: number,
    username: string,
    passwordHash: string,
  ): Promise<UserDtoRow | null> {
    try {
      return await this.prismaService.User.where({ id: userId })
        .where((user) => user.credentialsSetAt.isNull())
        .select(
          'id',
          'email',
          'name',
          'username',
          'avatarUrl',
          'role',
          'credentialsSetAt',
        )
        .update({ username, passwordHash, credentialsSetAt: new Date() });
    } catch (error) {
      if (this.isUsernameTaken(error)) {
        throw new ConflictException({
          code: 'USERNAME_TAKEN',
          message: 'That username is taken',
        });
      }
      throw error;
    }
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
    if (!this.isAllowedEmail(payload.email)) {
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

  /** True if `email` belongs to the allowed university domain (case-insensitive). */
  private isAllowedEmail(email: string): boolean {
    return email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
  }

  /** True if `error` is Postgres refusing a duplicate `User.username`. */
  private isUsernameTaken(error: unknown): boolean {
    const { sqlState, constraint } = (error ?? {}) as Record<string, unknown>;
    return (
      sqlState === PG_UNIQUE_VIOLATION &&
      constraint === USERNAME_UNIQUE_CONSTRAINT
    );
  }

  /** The user body stored in the session JWT. */
  private toSessionUser(row: UserDtoRow): SessionUser {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatarUrl,
      role: row.role,
    };
  }
}
