import { AUTH_ERROR_CODE } from '@repo/lib/auth/error-codes';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client as GoogleOAuthService } from 'google-auth-library';
import { BcryptService } from '@/bcrypt/bcrypt.service';
import { ClockService } from '@/clock/clock.service';
import { PrismaService } from '@/prisma/prisma.service';
import { SessionPayload } from '@/sessions/interfaces/session-payload.interface';
import { SessionRecord } from '@/sessions/interfaces/session-record.interface';
import { SessionUser } from '@/sessions/interfaces/session-user.interface';
import { SessionsService } from '@/sessions/sessions.service';
import {
  ALLOWED_EMAIL_DOMAINS,
  GOOGLE_HD_HINT,
  DUMMY_PASSWORD_HASH,
  GOOGLE_SCOPES,
  PASSWORD_RESET_WINDOW_MS,
  PG_UNIQUE_VIOLATION,
  USERNAME_UNIQUE_CONSTRAINT,
} from './auth.constants';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeUsernameDto } from './dto/change-username.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetupCredentialsDto } from './dto/setup-credentials.dto';
import { GoogleProfile } from './interfaces/google-profile.interface';
import { LoginResult } from './interfaces/login-result.interface';
import { UserDto } from './dto/user.dto';
import { UserDtoRow } from './dto/user-dto-row.dto';

/** Sign-in, Credential setup, username change, and password change or reset. */
@Injectable()
export class AuthService {
  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly prismaService: PrismaService,
    private readonly sessionsService: SessionsService,
    private readonly bcryptService: BcryptService,
    private readonly clockService: ClockService,
  ) {}

  /** Returns the Google consent-screen URL carrying `state`. */
  buildGoogleAuthUrl(state: string): string {
    return this.googleOAuthService.generateAuthUrl({
      scope: GOOGLE_SCOPES,
      state,
      prompt: 'select_account',
      // One hint only. Both domains are enforced in fetchGoogleProfile.
      hd: GOOGLE_HD_HINT,
    });
  }

  /** Signs in with Google's authorization `code` and returns the new session's cookie id. */
  async loginWithGoogle(code: string): Promise<string> {
    const profile = await this.fetchGoogleProfile(code);
    const user = await this.upsertUser(profile);
    return this.openUserSession(user, 'GOOGLE', this.clockService.now());
  }

  /**
   * Sets the user's username and password once, then replaces the session
   * so the new cookie carries Credential setup as done. The old cookie dies.
   * The `credentialsSetAt IS NULL` check and the write are one SQL statement,
   * so two requests can't both win. A failed setup leaves the session as it was.
   */
  async setupCredentials(
    userId: number,
    { username, password }: SetupCredentialsDto,
    cookieId: string,
  ): Promise<LoginResult> {
    const current = await this.requireCurrentUserSession(cookieId, userId);
    const passwordHash = await this.bcryptService.hash(password);
    const user = await this.claimCredentials(userId, username, passwordHash);
    if (!user) {
      throw new ConflictException({
        code: AUTH_ERROR_CODE.SETUP_ALREADY_DONE,
        message: 'Username and password are already set',
      });
    }
    const nextCookieId = await this.openUserSession(
      user,
      current.startedBy,
      this.toDate(current.lastLoginAt),
    );
    return { cookieId: nextCookieId, user };
  }

  /**
   * Username + password sign-in. The username must match exactly (no case folding).
   * Unknown username and wrong password give the same 401 and take the same time.
   * Rate-limited by the controller (LoginThrottlerGuard).
   */
  async loginWithPassword({
    username,
    password,
  }: LoginDto): Promise<LoginResult> {
    const user = await this.prismaService.User.where({ username })
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
        code: AUTH_ERROR_CODE.INVALID_CREDENTIALS,
        message: 'Wrong username or password',
      });
    }
    await this.prismaService.User.where({ id: user.id }).update({
      lastLoginAt: this.clockService.now(),
    });
    const cookieId = await this.openUserSession(user, 'PASSWORD', null);
    const { passwordHash: _, ...publicUser } = user;
    return { cookieId, user: publicUser };
  }

  /**
   * The signed-in User. Display name, email, avatar and Role come from the
   * session. Username and credentialsSetAt come from the database.
   */
  async getMe(sessionUser: SessionUser): Promise<UserDto> {
    const row = await this.prismaService.User.where({ id: sessionUser.id })
      .select('username', 'credentialsSetAt')
      .first();
    if (!row) throw this.createNotSignedInError();
    return this.toUserDto(sessionUser, row);
  }

  /**
   * Changes the User's username (sign-in handle). The old username is free for others at once, there is
   * no limit on how often, and the session stays (it does not carry the username).
   * Uniqueness is enforced by the database: a taken username is 409.
   */
  async changeUsername(
    sessionUser: SessionUser,
    { username }: ChangeUsernameDto,
  ): Promise<UserDto> {
    const row = await this.renameUser(sessionUser.id, username);
    if (!row) throw this.createNotSignedInError();
    return this.toUserDto(sessionUser, row);
  }

  /** Writes the new username; null if the User row is gone. A taken username is 409. */
  private async renameUser(
    userId: number,
    username: string,
  ): Promise<Pick<UserDto, 'username' | 'credentialsSetAt'> | null> {
    try {
      return await this.prismaService.User.where({ id: userId })
        .select('username', 'credentialsSetAt')
        .update({ username });
    } catch (error) {
      if (this.isUsernameTaken(error)) throw this.createUsernameTakenError();
      throw error;
    }
  }

  /**
   * Replaces the password when `currentPassword` matches.
   * A wrong current password is 401 and leaves the hash as it was.
   * The current session stays.
   */
  async changePassword(
    userId: number,
    { currentPassword, newPassword }: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prismaService.User.where({ id: userId })
      .select('passwordHash')
      .first();
    const isCurrentPasswordValid = await this.bcryptService.verify(
      currentPassword,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user?.passwordHash || !isCurrentPasswordValid) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODE.INVALID_CREDENTIALS,
        message: 'Wrong password',
      });
    }
    await this.replacePassword(userId, newPassword);
  }

  /**
   * Replaces the password without the current one.
   * Allowed only when this session was started by a Google sign-in less than
   * 10 minutes ago. Every password-started session is refused.
   * The current session stays.
   */
  async resetPassword(
    userId: number,
    { newPassword }: ResetPasswordDto,
    cookieId: string,
  ): Promise<void> {
    const session = await this.requireCurrentUserSession(cookieId, userId);
    if (!this.isRecentGoogleSignIn(session)) {
      throw new ForbiddenException({
        code: AUTH_ERROR_CODE.RECENT_GOOGLE_SIGN_IN_REQUIRED,
        message: 'Sign in with your University account again',
      });
    }
    await this.replacePassword(userId, newPassword);
  }

  /** Deletes the session behind `cookieId` and its pointer when it is still current. */
  async logout(cookieId: string): Promise<void> {
    await this.sessionsService.destroySession(cookieId);
  }

  /** Stores a new password hash. Does not touch the session. */
  private async replacePassword(
    userId: number,
    password: string,
  ): Promise<void> {
    await this.prismaService.User.where({ id: userId }).update({
      passwordHash: await this.bcryptService.hash(password),
    });
  }

  /** True when `lastLoginAt` is a Google sign-in still inside the reset window. */
  private isRecentGoogleSignIn(session: SessionPayload): boolean {
    if (session.startedBy !== 'GOOGLE' || session.lastLoginAt == null) {
      return false;
    }
    const ageMs =
      this.clockService.now().getTime() -
      new Date(session.lastLoginAt).getTime();
    return ageMs < PASSWORD_RESET_WINDOW_MS;
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
        .update({
          username,
          passwordHash,
          credentialsSetAt: this.clockService.now(),
        });
    } catch (error) {
      if (this.isUsernameTaken(error)) throw this.createUsernameTakenError();
      throw error;
    }
  }

  /** The 409 for a username another User already has. */
  private createUsernameTakenError(): ConflictException {
    return new ConflictException({
      code: AUTH_ERROR_CODE.USERNAME_TAKEN,
      message: 'That username is taken',
    });
  }

  /** The current User session, or 401 when this cookie is not that User's. */
  private async requireCurrentUserSession(
    cookieId: string,
    userId: number,
  ): Promise<SessionPayload> {
    const current = await this.sessionsService.findCurrentUserSession(cookieId);
    if (!current || current.id !== userId) throw this.createNotSignedInError();
    return current;
  }

  /** The 401 for a request whose session no longer matches a signed-in User. */
  private createNotSignedInError(): UnauthorizedException {
    return new UnauthorizedException({
      code: AUTH_ERROR_CODE.NOT_SIGNED_IN,
      message: 'Sign in first',
    });
  }

  /**
   * The User as the API returns it: profile and Role from the session,
   * username and credentialsSetAt from the database row.
   */
  private toUserDto(
    sessionUser: SessionUser,
    row: Pick<UserDto, 'username' | 'credentialsSetAt'>,
  ): UserDto {
    return {
      id: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.name,
      avatarUrl: sessionUser.avatarUrl,
      role: sessionUser.role,
      username: row.username,
      credentialsSetAt: row.credentialsSetAt,
    };
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
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODE.EMAIL_NOT_VERIFIED,
        message: 'Google account has no verified email',
      });
    }
    if (!this.isAllowedEmail(payload.email)) {
      throw new ForbiddenException({
        code: AUTH_ERROR_CODE.DOMAIN_NOT_ALLOWED,
        message: `Sign in with your @${ALLOWED_EMAIL_DOMAINS.join(' or @')} account`,
      });
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
    throw new UnauthorizedException({
      code: AUTH_ERROR_CODE.LOGIN_EXPIRED,
      message: 'Invalid Google authorization code',
    });
  }

  /** Creates the user on first login, otherwise refreshes their profile and last login. */
  private async upsertUser(profile: GoogleProfile): Promise<UserDtoRow> {
    const lastLoginAt = this.clockService.now();
    return this.prismaService.User.select(
      'id',
      'email',
      'name',
      'username',
      'avatarUrl',
      'role',
      'credentialsSetAt',
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

  /** True if `email`'s domain is an allowed university domain (case-insensitive). */
  private isAllowedEmail(email: string): boolean {
    const domain = email.toLowerCase().split('@').at(-1);
    return (
      domain !== undefined &&
      ALLOWED_EMAIL_DOMAINS.some((allowed) => allowed === domain)
    );
  }

  /** True if `error` is Postgres refusing a duplicate `User.username`. */
  private isUsernameTaken(error: unknown): boolean {
    const { sqlState, constraint } = (error ?? {}) as Record<string, unknown>;
    return (
      sqlState === PG_UNIQUE_VIOLATION &&
      constraint === USERNAME_UNIQUE_CONSTRAINT
    );
  }

  /** Opens a User session, ending whatever session this User had. */
  private openUserSession(
    user: UserDtoRow,
    startedBy: SessionRecord['startedBy'],
    lastLoginAt: Date | null,
  ): Promise<string> {
    return this.sessionsService.createSession({
      kind: 'USER',
      id: user.id,
      user: this.toSessionUser(user),
      credentialsSetAt: user.credentialsSetAt,
      startedBy,
      lastLoginAt,
    });
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

  /** `lastLoginAt` from the session JWT, or null when this session has none. */
  private toDate(value: string | null): Date | null {
    if (!value) return null;
    return new Date(value);
  }
}
