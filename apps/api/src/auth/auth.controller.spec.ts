import { Test, TestingModule } from '@nestjs/testing';
import { LoginThrottlerGuard } from '@/common/guards/login-throttler.guard';
import type { Response } from 'express';
import { SessionGuard } from '@/common/guards/session.guard';
import { SESSION_COOKIE_NAME } from '@/sessions/sessions.constants';
import { OAUTH_STATE_COOKIE_NAME } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { OAuthState } from './interfaces/oauth-state.interface';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuth: Record<
    | 'buildGoogleAuthUrl'
    | 'loginWithGoogle'
    | 'setupCredentials'
    | 'loginWithPassword'
    | 'getMe'
    | 'changeUsername'
    | 'logout',
    jest.Mock
  >;
  const expectedUser = {
    id: 1,
    username: 'somchai_k',
    credentialsSetAt: new Date(),
  };
  const inputOAuthState = JSON.stringify({
    state: 'state-1',
    next: '/problems/1',
  });
  let mockRes: {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
    redirect: jest.Mock;
  };

  beforeEach(async () => {
    mockAuth = {
      buildGoogleAuthUrl: jest.fn(
        (state: string) => `https://google/?state=${state}`,
      ),
      loginWithGoogle: jest.fn().mockResolvedValue('cookie-id'),
      setupCredentials: jest.fn().mockResolvedValue({
        cookieId: 'cookie-id',
        user: expectedUser,
      }),
      loginWithPassword: jest
        .fn()
        .mockResolvedValue({ cookieId: 'cookie-id', user: expectedUser }),
      getMe: jest.fn().mockResolvedValue(expectedUser),
      changeUsername: jest.fn().mockResolvedValue(expectedUser),
      logout: jest.fn().mockResolvedValue(undefined),
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
      .overrideGuard(LoginThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AuthController);
  });

  it('GET /auth/google stores a state cookie and returns the Google URL with it', () => {
    const actualBody = controller.getGoogleAuthUrl(
      '/problems/1',
      mockRes as unknown as Response,
    );
    const [actualCookieName, actualCookieValue] = mockRes.cookie.mock
      .calls[0] as [string, string];
    const actualOAuthState = JSON.parse(actualCookieValue) as OAuthState;
    expect(actualCookieName).toBe(OAUTH_STATE_COOKIE_NAME);
    expect(actualOAuthState.next).toBe('/problems/1');
    expect(actualBody).toEqual({
      url: `https://google/?state=${actualOAuthState.state}`,
    });
    expect(mockRes.redirect).not.toHaveBeenCalled();
  });

  it('callback signs in, sets the session cookie and redirects to next', async () => {
    await controller.handleGoogleCallback(
      'code',
      'state-1',
      inputOAuthState,
      mockRes as unknown as Response,
    );
    expect(mockAuth.loginWithGoogle).toHaveBeenCalledWith('code');
    expect(mockRes.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      'cookie-id',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(mockRes.redirect).toHaveBeenCalledWith('/problems/1');
  });

  it('callback sends a state that does not match the cookie to /login?error=LOGIN_EXPIRED', async () => {
    await controller.handleGoogleCallback(
      'code',
      'forged',
      inputOAuthState,
      mockRes as unknown as Response,
    );
    expect(mockAuth.loginWithGoogle).not.toHaveBeenCalled();
    expect(mockRes.redirect).toHaveBeenCalledWith('/login?error=LOGIN_EXPIRED');
  });

  it('callback sends a missing state cookie to /login?error=LOGIN_EXPIRED', async () => {
    await controller.handleGoogleCallback(
      'code',
      'state-1',
      undefined,
      mockRes as unknown as Response,
    );
    expect(mockAuth.loginWithGoogle).not.toHaveBeenCalled();
    expect(mockRes.redirect).toHaveBeenCalledWith('/login?error=LOGIN_EXPIRED');
  });

  it('POST /auth/setup sets credentials and replaces ngg.sid', async () => {
    const inputBody = { username: 'somchai_k', password: 'password123' };
    const actualBody = await controller.setupCredentials(
      { id: 1 } as never,
      inputBody,
      'old-cookie',
      mockRes as unknown as Response,
    );
    expect(mockAuth.setupCredentials).toHaveBeenCalledWith(
      1,
      inputBody,
      'old-cookie',
    );
    expect(mockRes.cookie).toHaveBeenCalledWith(
      'ngg.sid',
      'cookie-id',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
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

  it('GET /auth/me returns the signed-in user', async () => {
    const inputUser = { id: 1 } as never;
    const actualBody = await controller.getMe(inputUser);
    expect(mockAuth.getMe).toHaveBeenCalledWith(inputUser);
    expect(actualBody).toEqual(expectedUser);
  });

  it('PATCH /auth/username changes the username and leaves ngg.sid alone', async () => {
    const inputUser = { id: 1 } as never;
    const inputBody = { username: 'somchai_new' };
    const actualBody = await controller.changeUsername(inputUser, inputBody);
    expect(mockAuth.changeUsername).toHaveBeenCalledWith(inputUser, inputBody);
    expect(actualBody).toEqual(expectedUser);
    expect(mockRes.cookie).not.toHaveBeenCalled();
    expect(mockRes.clearCookie).not.toHaveBeenCalled();
  });

  it('POST /auth/logout deletes the session and clears only ngg.sid', async () => {
    await controller.logout('cookie-id', mockRes as unknown as Response);
    expect(mockAuth.logout).toHaveBeenCalledWith('cookie-id');
    expect(mockRes.clearCookie).toHaveBeenCalledWith(
      'ngg.sid',
      expect.objectContaining({ path: '/' }),
    );
    const actualClearedNames = mockRes.clearCookie.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(actualClearedNames).toEqual(['ngg.sid']);
  });
});
