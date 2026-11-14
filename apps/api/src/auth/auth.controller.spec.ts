import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { SessionGuard } from '@/common/guards/session.guard';
import { SESSION_COOKIE_NAME } from '@/sessions/sessions.constants';
import { OAUTH_STATE_COOKIE_NAME } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuth: Record<
    | 'buildGoogleAuthUrl'
    | 'loginWithGoogle'
    | 'setupCredentials'
    | 'loginWithPassword',
    jest.Mock
  >;
  const expectedUser = {
    id: 1,
    username: 'somchai_k',
    credentialsSetAt: new Date(),
  };
  let mockRes: {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
    redirect: jest.Mock;
  };

  const createRequest = (state?: string): Request =>
    ({ cookies: { [OAUTH_STATE_COOKIE_NAME]: state } }) as unknown as Request;

  beforeEach(async () => {
    process.env['WEB_URL'] = 'http://localhost:3000';
    mockAuth = {
      buildGoogleAuthUrl: jest.fn(
        (state: string) => `https://google/?state=${state}`,
      ),
      loginWithGoogle: jest.fn().mockResolvedValue('cookie-id'),
      setupCredentials: jest.fn().mockResolvedValue(expectedUser),
      loginWithPassword: jest
        .fn()
        .mockResolvedValue({ cookieId: 'cookie-id', user: expectedUser }),
    };
    mockRes = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuth }],
    })
      .overrideGuard(SessionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AuthController);
  });

  it('GET /auth/google stores a state cookie and returns the Google URL with it', () => {
    const actualBody = controller.getGoogleAuthUrl(
      mockRes as unknown as Response,
    );
    const [cookieName, actualState] = mockRes.cookie.mock.calls[0] as [
      string,
      string,
    ];
    expect(cookieName).toBe(OAUTH_STATE_COOKIE_NAME);
    expect(actualBody).toEqual({ url: `https://google/?state=${actualState}` });
    expect(mockRes.redirect).not.toHaveBeenCalled();
  });

  it('callback signs in, sets the session cookie and redirects to the web app', async () => {
    await controller.handleGoogleCallback(
      'code',
      'state-1',
      createRequest('state-1'),
      mockRes as unknown as Response,
    );
    expect(mockAuth.loginWithGoogle).toHaveBeenCalledWith('code');
    expect(mockRes.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      'cookie-id',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(mockRes.redirect).toHaveBeenCalledWith('http://localhost:3000');
  });

  it('callback rejects a state that does not match the cookie', async () => {
    await expect(
      controller.handleGoogleCallback(
        'code',
        'forged',
        createRequest('state-1'),
        mockRes as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mockAuth.loginWithGoogle).not.toHaveBeenCalled();
  });

  it('callback rejects when the state cookie is missing', async () => {
    await expect(
      controller.handleGoogleCallback(
        'code',
        'state-1',
        createRequest(undefined),
        mockRes as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('POST /auth/setup sets credentials for the signed-in user', async () => {
    const inputBody = { username: 'somchai_k', password: 'password123' };
    const actualBody = await controller.setupCredentials(
      { id: 1 } as never,
      inputBody,
    );
    expect(mockAuth.setupCredentials).toHaveBeenCalledWith(1, inputBody);
    expect(actualBody).toEqual(expectedUser);
  });

  it('POST /auth/login sets the ngg.sid cookie and returns the user', async () => {
    const inputBody = { username: 'somchai_k', password: 'password123' };
    const actualBody = await controller.loginWithPassword(
      inputBody,
      mockRes as unknown as Response,
    );
    expect(mockAuth.loginWithPassword).toHaveBeenCalledWith(inputBody);
    expect(mockRes.cookie).toHaveBeenCalledWith(
      'ngg.sid',
      'cookie-id',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(actualBody).toEqual(expectedUser);
  });
});
