import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OAuth2Client as GoogleOAuthService } from 'google-auth-library';
import { BcryptService } from '@/bcrypt/bcrypt.service';
import { ClockService } from '@/clock/clock.service';
import { PrismaService } from '@/prisma/prisma.service';
import type { SessionPayload } from '@/sessions/interfaces/session-payload.interface';
import { SessionsService } from '@/sessions/sessions.service';
import { DUMMY_PASSWORD_HASH } from './auth.constants';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const inputPayload = {
    sub: 'google-123',
    email: 's6601012345678@email.kmutnb.ac.th',
    email_verified: true,
    name: 'Student',
    picture: 'https://example.com/a.png',
  };
  const inputUserRow = {
    id: 1,
    email: inputPayload.email,
    name: inputPayload.name,
    username: 'somchai_k',
    avatarUrl: inputPayload.picture,
    role: 'STUDENT',
    credentialsSetAt: new Date(),
    passwordHash: '$2b$12$hash',
  };
  const expectedUser = {
    id: 1,
    email: inputPayload.email,
    name: inputPayload.name,
    username: 'somchai_k',
    avatarUrl: inputPayload.picture,
    role: 'STUDENT',
    credentialsSetAt: inputUserRow.credentialsSetAt,
  };
  const inputSessionUser = {
    id: 1,
    email: inputPayload.email,
    name: inputPayload.name,
    avatarUrl: inputPayload.picture,
    role: 'STUDENT' as const,
  };
  const inputSession: SessionPayload = {
    ...inputSessionUser,
    kind: 'USER',
    startedBy: 'GOOGLE',
    credentialsSetAt: null,
    lastLoginAt: '2026-11-01T09:00:00.000Z',
  };
  let service: AuthService;
  let mockGoogle: {
    generateAuthUrl: jest.Mock;
    getToken: jest.Mock;
    verifyIdToken: jest.Mock;
  };
  let mockUser: Record<
    'where' | 'select' | 'upsert' | 'update' | 'first',
    jest.Mock
  >;
  let mockCreateSession: jest.Mock;
  let mockDestroySession: jest.Mock;
  let mockBcrypt: { hash: jest.Mock; verify: jest.Mock };

  beforeEach(async () => {
    mockGoogle = {
      generateAuthUrl: jest
        .fn()
        .mockReturnValue('https://accounts.google.com/x'),
      getToken: jest
        .fn()
        .mockResolvedValue({ tokens: { id_token: 'id-token' } }),
      verifyIdToken: jest
        .fn()
        .mockResolvedValue({ getPayload: () => inputPayload }),
    };
    mockUser = {
      where: jest.fn(() => mockUser),
      select: jest.fn(() => mockUser),
      upsert: jest.fn().mockResolvedValue(inputUserRow),
      update: jest.fn().mockResolvedValue(inputUserRow),
      first: jest.fn().mockResolvedValue(inputUserRow),
    };
    mockCreateSession = jest.fn().mockResolvedValue('cookie-id');
    mockDestroySession = jest.fn().mockResolvedValue(undefined);
    mockBcrypt = {
      hash: jest.fn().mockResolvedValue('$2b$12$hash'),
      verify: jest.fn().mockResolvedValue(true),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: GoogleOAuthService, useValue: mockGoogle },
        { provide: PrismaService, useValue: { User: mockUser } },
        {
          provide: SessionsService,
          useValue: {
            createSession: mockCreateSession,
            destroySession: mockDestroySession,
          },
        },
        { provide: BcryptService, useValue: mockBcrypt },
        ClockService,
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('Google', () => {
    it('builds the Google URL with the given state', () => {
      const actualUrl = service.buildGoogleAuthUrl('state-1');
      expect(actualUrl).toBe('https://accounts.google.com/x');
      expect(mockGoogle.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'state-1' }),
      );
    });

    it('upserts the user by googleId and returns a session cookie id', async () => {
      const actualCookieId = await service.loginWithGoogle('code');
      expect(actualCookieId).toBe('cookie-id');
      expect(mockUser.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            googleId: 'google-123',
            email: inputPayload.email,
          }) as unknown,
          conflictOn: { googleId: 'google-123' },
        }),
      );
    });

    it('rejects an invalid authorization code', async () => {
      mockGoogle.getToken.mockRejectedValue(new Error('invalid_grant'));
      await expect(service.loginWithGoogle('bad')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    it('rejects a Google account without a verified email', async () => {
      mockGoogle.verifyIdToken.mockResolvedValue({
        getPayload: () => ({ ...inputPayload, email_verified: false }),
      });
      await expect(service.loginWithGoogle('code')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(mockUser.upsert).not.toHaveBeenCalled();
    });

    it.each(['staff@kmutnb.ac.th', 'Staff@KMUTNB.AC.TH'])(
      'accepts the staff domain %s',
      async (inputEmail) => {
        mockGoogle.verifyIdToken.mockResolvedValue({
          getPayload: () => ({ ...inputPayload, email: inputEmail }),
        });
        await expect(service.loginWithGoogle('code')).resolves.toBe(
          'cookie-id',
        );
      },
    );

    it.each([
      'student@gmail.com',
      'student@notemail.kmutnb.ac.th',
      'student@email.kmutnb.ac.th.evil.com',
    ])('rejects %s (not a university domain)', async (inputEmail) => {
      mockGoogle.verifyIdToken.mockResolvedValue({
        getPayload: () => ({ ...inputPayload, email: inputEmail }),
      });
      await expect(service.loginWithGoogle('code')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(mockUser.upsert).not.toHaveBeenCalled();
    });

    it('accepts the university domain in any letter case', async () => {
      mockGoogle.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          ...inputPayload,
          email: 'Student@EMAIL.KMUTNB.AC.TH',
        }),
      });
      await expect(service.loginWithGoogle('code')).resolves.toBe('cookie-id');
    });

    it('opens a USER session started by Google', async () => {
      await service.loginWithGoogle('code');
      expect(mockCreateSession).toHaveBeenCalledWith({
        kind: 'USER',
        id: 1,
        user: {
          id: 1,
          email: inputPayload.email,
          name: inputPayload.name,
          avatarUrl: inputPayload.picture,
          role: 'STUDENT',
        },
        credentialsSetAt: inputUserRow.credentialsSetAt,
        startedBy: 'GOOGLE',
        lastLoginAt: expect.any(Date) as unknown,
      });
    });

    it('records Credential setup as not done when credentialsSetAt is null', async () => {
      mockUser.upsert.mockResolvedValue({
        ...inputUserRow,
        username: null,
        credentialsSetAt: null,
      });
      await service.loginWithGoogle('code');
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ credentialsSetAt: null }),
      );
    });

    it('asks Google to prefer university accounts', () => {
      service.buildGoogleAuthUrl('state-1');
      expect(mockGoogle.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({ hd: 'email.kmutnb.ac.th' }),
      );
    });
  });

  describe('setupCredentials', () => {
    const inputBody = { username: 'somchai_k', password: 'password123' };

    it('stores only the bcrypt hash and replaces the session with setup done', async () => {
      // select() drops passwordHash; the mock ignores select, so stub the row it would return.
      mockUser.update.mockResolvedValue(expectedUser);
      const actualResult = await service.setupCredentials(
        inputSession,
        inputBody,
      );
      expect(actualResult).toEqual({
        cookieId: 'cookie-id',
        user: expectedUser,
      });
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123');
      expect(mockUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'somchai_k',
          passwordHash: '$2b$12$hash',
          credentialsSetAt: expect.any(Date) as unknown,
        }),
      );
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'USER',
          id: 1,
          startedBy: 'GOOGLE',
          credentialsSetAt: inputUserRow.credentialsSetAt,
          lastLoginAt: new Date('2026-11-01T09:00:00.000Z'),
        }),
      );
      expect(JSON.stringify(mockUser.update.mock.calls)).not.toContain(
        'password123',
      );
    });

    it('409 SETUP_ALREADY_DONE when credentials are already set', async () => {
      mockUser.update.mockResolvedValue(null);
      const actualError = await service
        .setupCredentials(inputSession, inputBody)
        .catch((error: unknown) => error);
      expect(actualError).toBeInstanceOf(ConflictException);
      expect((actualError as ConflictException).getResponse()).toMatchObject({
        code: 'SETUP_ALREADY_DONE',
      });
      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    it('409 USERNAME_TAKEN on a unique violation of User.username', async () => {
      mockUser.update.mockRejectedValue({
        sqlState: '23505',
        constraint: 'User_username_key',
      });
      const actualError = await service
        .setupCredentials(inputSession, inputBody)
        .catch((error: unknown) => error);
      expect(actualError).toBeInstanceOf(ConflictException);
      expect((actualError as ConflictException).getResponse()).toMatchObject({
        code: 'USERNAME_TAKEN',
      });
      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    it('rethrows unrelated database errors', async () => {
      const inputError = new Error('connection lost');
      mockUser.update.mockRejectedValue(inputError);
      await expect(
        service.setupCredentials(inputSession, inputBody),
      ).rejects.toBe(inputError);
      expect(mockCreateSession).not.toHaveBeenCalled();
    });
  });

  describe('loginWithPassword', () => {
    const inputBody = { username: 'Somchai_K', password: 'password123' };

    it('signs in, looks up the username exactly as typed and returns the user', async () => {
      const actualResult = await service.loginWithPassword(inputBody);
      expect(actualResult).toEqual({
        cookieId: 'cookie-id',
        user: expectedUser,
      });
      expect(mockUser.where).toHaveBeenCalledWith({ username: 'Somchai_K' });
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'USER',
          id: 1,
          startedBy: 'PASSWORD',
          lastLoginAt: null,
          credentialsSetAt: inputUserRow.credentialsSetAt,
        }),
      );
    });

    it('401 INVALID_CREDENTIALS for a wrong password', async () => {
      mockBcrypt.verify.mockResolvedValue(false);
      const actualError = await service
        .loginWithPassword(inputBody)
        .catch((error: unknown) => error);
      expect(actualError).toBeInstanceOf(UnauthorizedException);
      expect(
        (actualError as UnauthorizedException).getResponse(),
      ).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    it('same 401 for an unknown username, still running bcrypt (no timing leak)', async () => {
      mockUser.first.mockResolvedValue(null);
      mockBcrypt.verify.mockResolvedValue(false);
      await expect(service.loginWithPassword(inputBody)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(mockBcrypt.verify).toHaveBeenCalledWith(
        'password123',
        DUMMY_PASSWORD_HASH,
      );
    });

    it('401 for a Google-only user who never set a password', async () => {
      mockUser.first.mockResolvedValue({ ...inputUserRow, passwordHash: null });
      await expect(service.loginWithPassword(inputBody)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(mockCreateSession).not.toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('returns the session Role and the username from the database', async () => {
      mockUser.first.mockResolvedValue({
        username: 'somchai_k',
        credentialsSetAt: inputUserRow.credentialsSetAt,
      });
      const actualUser = await service.getMe(inputSessionUser);
      expect(actualUser).toEqual(expectedUser);
    });

    it('401 NOT_SIGNED_IN when the User row is gone', async () => {
      mockUser.first.mockResolvedValue(null);
      const actualError = await service
        .getMe(inputSessionUser)
        .catch((error: unknown) => error);
      expect(actualError).toBeInstanceOf(UnauthorizedException);
      expect(
        (actualError as UnauthorizedException).getResponse(),
      ).toMatchObject({ code: 'NOT_SIGNED_IN' });
    });
  });

  describe('changeUsername', () => {
    it('stores the new username and returns the User without touching the session', async () => {
      mockUser.update.mockResolvedValue({
        username: 'somchai_new',
        credentialsSetAt: inputUserRow.credentialsSetAt,
      });
      const actualUser = await service.changeUsername(inputSessionUser, {
        username: 'somchai_new',
      });
      expect(actualUser).toEqual({
        ...expectedUser,
        username: 'somchai_new',
      });
      expect(mockUser.where).toHaveBeenCalledWith({ id: 1 });
      expect(mockUser.update).toHaveBeenCalledWith({ username: 'somchai_new' });
      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(mockDestroySession).not.toHaveBeenCalled();
    });

    it('409 USERNAME_TAKEN on a unique violation of User.username', async () => {
      mockUser.update.mockRejectedValue({
        sqlState: '23505',
        constraint: 'User_username_key',
      });
      const actualError = await service
        .changeUsername(inputSessionUser, { username: 'other_one' })
        .catch((error: unknown) => error);
      expect(actualError).toBeInstanceOf(ConflictException);
      expect((actualError as ConflictException).getResponse()).toMatchObject({
        code: 'USERNAME_TAKEN',
      });
    });

    it('rethrows unrelated database errors', async () => {
      const inputError = new Error('connection lost');
      mockUser.update.mockRejectedValue(inputError);
      await expect(
        service.changeUsername(inputSessionUser, { username: 'somchai_new' }),
      ).rejects.toBe(inputError);
    });

    it('401 NOT_SIGNED_IN when the User row is gone', async () => {
      mockUser.update.mockResolvedValue(null);
      const actualError = await service
        .changeUsername(inputSessionUser, { username: 'somchai_new' })
        .catch((error: unknown) => error);
      expect(actualError).toBeInstanceOf(UnauthorizedException);
      expect(
        (actualError as UnauthorizedException).getResponse(),
      ).toMatchObject({ code: 'NOT_SIGNED_IN' });
    });
  });

  describe('logout', () => {
    it('deletes the session', async () => {
      await service.logout('cookie-id');
      expect(mockDestroySession).toHaveBeenCalledWith('cookie-id');
    });
  });
});
