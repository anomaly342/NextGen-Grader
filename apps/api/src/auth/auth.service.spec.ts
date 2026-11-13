import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OAuth2Client as GoogleOAuthService } from 'google-auth-library';
import { PrismaService } from '@/prisma/prisma.service';
import { SessionsService } from '@/sessions/sessions.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const inputPayload = {
    sub: 'google-123',
    email: 's6601012345678@email.kmutnb.ac.th',
    email_verified: true,
    name: 'Student',
    picture: 'https://example.com/a.png',
  };
  const expectedUser = {
    id: 1,
    email: inputPayload.email,
    name: inputPayload.name,
    avatarUrl: inputPayload.picture,
    role: 'STUDENT',
  };
  let service: AuthService;
  let mockGoogle: {
    generateAuthUrl: jest.Mock;
    getToken: jest.Mock;
    verifyIdToken: jest.Mock;
  };
  let mockUpsert: jest.Mock;
  let mockCreateSession: jest.Mock;

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
    mockUpsert = jest.fn().mockResolvedValue(expectedUser);
    mockCreateSession = jest.fn().mockResolvedValue('cookie-id');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: GoogleOAuthService, useValue: mockGoogle },
        {
          provide: PrismaService,
          useValue: { User: { select: () => ({ upsert: mockUpsert }) } },
        },
        {
          provide: SessionsService,
          useValue: { createSession: mockCreateSession },
        },
      ],
    }).compile();
    service = module.get(AuthService);
  });

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
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          googleId: 'google-123',
          email: inputPayload.email,
        }) as unknown,
        conflictOn: { googleId: 'google-123' },
      }),
    );
    expect(mockCreateSession).toHaveBeenCalledWith(expectedUser);
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
    expect(mockUpsert).not.toHaveBeenCalled();
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
    expect(mockUpsert).not.toHaveBeenCalled();
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
