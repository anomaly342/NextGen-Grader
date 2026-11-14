import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OAuth2Client as GoogleOAuthService } from 'google-auth-library';
import { BcryptService } from '@/bcrypt/bcrypt.service';
import { PrismaService } from '@/prisma/prisma.service';
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
  const expectedUserDto = {
    id: 1,
    email: inputPayload.email,
    name: inputPayload.name,
    username: 'somchai_k',
    avatarUrl: inputPayload.picture,
    role: 'STUDENT',
    credentialsSetAt: inputUserRow.credentialsSetAt,
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
          useValue: { createSession: mockCreateSession },
        },
        { provide: BcryptService, useValue: mockBcrypt },
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

    it.each([
      'student@gmail.com',
      'student@kmutnb.ac.th',
      'student@notemail.kmutnb.ac.th',
      'student@email.kmutnb.ac.th.evil.com',
    ])('rejects %s (not @email.kmutnb.ac.th)', async (inputEmail) => {
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

    it('asks Google to prefer university accounts', () => {
      service.buildGoogleAuthUrl('state-1');
      expect(mockGoogle.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({ hd: 'email.kmutnb.ac.th' }),
      );
    });
  });

  describe('setupCredentials', () => {
    const inputBody = { username: 'somchai_k', password: 'password123' };

    it('stores only the bcrypt hash and returns credentialsSetAt', async () => {
      // select() drops passwordHash; the mock ignores select, so stub the row it would return.
      mockUser.update.mockResolvedValue(expectedUserDto);
      const actualUser = await service.setupCredentials(1, inputBody);
      expect(actualUser).toEqual(expectedUserDto);
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123');
      expect(mockUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'somchai_k',
          passwordHash: '$2b$12$hash',
          credentialsSetAt: expect.any(Date) as unknown,
        }),
      );
      expect(JSON.stringify(mockUser.update.mock.calls)).not.toContain(
        'password123',
      );
    });

    it('409 SETUP_ALREADY_DONE when credentials are already set', async () => {
      mockUser.update.mockResolvedValue(null);
      const actualError = await service
        .setupCredentials(1, inputBody)
        .catch((error: unknown) => error);
      expect(actualError).toBeInstanceOf(ConflictException);
      expect((actualError as ConflictException).getResponse()).toMatchObject({
        code: 'SETUP_ALREADY_DONE',
      });
    });

    it('409 USERNAME_TAKEN on a unique violation of User.username', async () => {
      mockUser.update.mockRejectedValue({
        sqlState: '23505',
        constraint: 'User_username_key',
      });
      const actualError = await service
        .setupCredentials(1, inputBody)
        .catch((error: unknown) => error);
      expect(actualError).toBeInstanceOf(ConflictException);
      expect((actualError as ConflictException).getResponse()).toMatchObject({
        code: 'USERNAME_TAKEN',
      });
    });

    it('rethrows unrelated database errors', async () => {
      const inputError = new Error('connection lost');
      mockUser.update.mockRejectedValue(inputError);
      await expect(service.setupCredentials(1, inputBody)).rejects.toBe(
        inputError,
      );
    });
  });

  describe('loginWithPassword', () => {
    const inputBody = { username: 'Somchai_K', password: 'password123' };

    it('signs in, lowercases the username and returns the user', async () => {
      const actualResult = await service.loginWithPassword(inputBody);
      expect(actualResult).toEqual({
        cookieId: 'cookie-id',
        user: expectedUserDto,
      });
      expect(mockUser.where).toHaveBeenCalledWith({ username: 'somchai_k' });
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
});
