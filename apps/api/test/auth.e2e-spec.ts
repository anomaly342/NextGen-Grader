import request, { type Response, type Test } from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Redis } from 'ioredis';
import { PrismaService } from '@/prisma/prisma.service';
import { EXAMINEE_SESSION_COOKIE_NAME } from '@/sessions/sessions.constants';
import { SessionsService } from '@/sessions/sessions.service';
import { createE2eApp } from './support/e2e-app.util';
import type { GoogleCallbackErrorCode } from '@/auth/interfaces/google-callback-error-code.interface';
import type { E2eApp } from './support/interfaces/e2e-app.interface';
import type { FakeGoogleProfile } from './support/interfaces/fake-google-profile.interface';

const STUDENT_EMAIL = 's6601012345678@email.kmutnb.ac.th';
const OTHER_STUDENT_EMAIL = 's6601098765432@email.kmutnb.ac.th';
const PASSWORD = 'password123';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

describe('Auth (e2e)', () => {
  let e2e: E2eApp;

  /** A browser: keeps its own cookies, like one device in the lab. */
  const createDevice = (): TestAgent => request.agent(e2e.webHost);

  /**
   * Starts Google sign-in on `inputDevice` (asking to come back to `next`, if given)
   * and returns the `state` Google would echo back.
   */
  async function startGoogleSignIn(
    inputDevice: TestAgent,
    next?: string,
  ): Promise<string> {
    const actualResponse = await inputDevice
      .get('/api/auth/google')
      .query(next === undefined ? {} : { next })
      .expect(200);
    const { url } = actualResponse.body as { url: string };
    return new URL(url).searchParams.get('state')!;
  }

  /** Runs the whole Google flow on `inputDevice` as `profile`, optionally asking to come back to `next`. */
  async function signInWithGoogle(
    inputDevice: TestAgent,
    profile: FakeGoogleProfile,
    next?: string,
  ): Promise<Response> {
    const code = `code-for-${profile.email}`;
    e2e.google.registerCode(code, profile);
    const state = await startGoogleSignIn(inputDevice, next);
    return inputDevice.get('/api/auth/google/callback').query({ code, state });
  }

  /** Credential setup on a device that is already signed in. */
  const setupCredentials = (inputDevice: TestAgent, username: string): Test =>
    inputDevice.post('/api/auth/setup').send({ username, password: PASSWORD });

  /** A User who signed in with Google once and finished Credential setup. */
  async function createUserWithCredentials(
    email: string,
    username: string,
  ): Promise<void> {
    const inputDevice = createDevice();
    await signInWithGoogle(inputDevice, { email });
    await setupCredentials(inputDevice, username).expect(200);
  }

  /** Waits for `pending` and checks it failed with `status` and error `code`. */
  async function expectErrorCode(
    pending: Test,
    status: number,
    code: string,
  ): Promise<void> {
    const actualResponse = await pending.expect(status);
    expect(actualResponse.body).toMatchObject({ code });
  }

  /** The Set-Cookie header of `actualResponse` for cookie `name`, if any. */
  function findCookie(
    actualResponse: Response,
    name: string,
  ): string | undefined {
    return ([] as string[])
      .concat(actualResponse.headers['set-cookie'] ?? [])
      .find((cookie) => cookie.startsWith(`${name}=`));
  }

  /** The `ngg.sid` Set-Cookie header of `actualResponse`, if any. */
  const findSessionCookie = (actualResponse: Response): string | undefined =>
    findCookie(actualResponse, 'ngg.sid');

  /** Checks a Google callback sent the browser to /login with error `code` and set no session. */
  function expectLoginError(
    actualResponse: Response,
    code: GoogleCallbackErrorCode,
  ): void {
    expect(actualResponse.status).toBe(302);
    expect(actualResponse.headers['location']).toBe(`/login?error=${code}`);
    expect(findSessionCookie(actualResponse)).toBeUndefined();
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
  });

  beforeEach(async () => {
    await e2e.resetState();
  });

  afterAll(async () => {
    await e2e.close();
  });

  describe('Google sign-in', () => {
    it('through the web host: creates the User, sets a host-only ngg.sid and redirects to /', async () => {
      // Given a student with a verified university account
      const inputDevice = createDevice();
      // When they sign in with Google through the web host's /api rewrite
      const actualResponse = await signInWithGoogle(inputDevice, {
        email: STUDENT_EMAIL,
        name: 'Somchai K.',
      });
      // Then they land on the start page with a host-only session cookie for the whole site
      expect(actualResponse.status).toBe(302);
      expect(actualResponse.headers['location']).toBe('/');
      const actualSessionCookie = findSessionCookie(actualResponse);
      expect(actualSessionCookie).toMatch(/HttpOnly/);
      expect(actualSessionCookie).toMatch(/Path=\/;/);
      expect(actualSessionCookie).not.toMatch(/Domain=/i);
      const { body: actualUser } = (await setupCredentials(
        inputDevice,
        'somchai_k',
      ).expect(200)) as { body: unknown };
      expect(actualUser).toMatchObject({
        email: STUDENT_EMAIL,
        name: 'Somchai K.',
        role: 'STUDENT',
        username: 'somchai_k',
      });
    });

    it('scopes the host-only oauth_state cookie to the browser-visible /api/auth/google path', async () => {
      // Given a fresh device
      // When it starts Google sign-in through the web host
      const actualResponse = await createDevice()
        .get('/api/auth/google')
        .expect(200);
      // Then the state cookie only goes back to /api/auth/google/..., never Nest's internal path
      const actualStateCookie = findCookie(actualResponse, 'oauth_state');
      expect(actualStateCookie).toMatch(/Path=\/api\/auth\/google;/);
      expect(actualStateCookie).toMatch(/HttpOnly/);
      expect(actualStateCookie).not.toMatch(/Domain=/i);
    });

    it('serves the API under /api/v1 only', async () => {
      // Given a device with no session
      // When it calls who am I on Nest directly, with and without the prefix
      // Then only the prefixed route exists
      await expectErrorCode(
        request(e2e.app.getHttpServer()).get('/api/v1/auth/me'),
        401,
        'NOT_SIGNED_IN',
      );
      await request(e2e.app.getHttpServer()).get('/auth/me').expect(404);
    });

    it('comes back to a same-site next path after sign-in', async () => {
      // Given a student who opened /problems/1 while signed out
      const inputDevice = createDevice();
      // When they sign in with Google asking to come back there
      const actualResponse = await signInWithGoogle(
        inputDevice,
        { email: STUDENT_EMAIL },
        '/problems/1?tab=statement',
      );
      // Then they land on that page, signed in
      expect(actualResponse.status).toBe(302);
      expect(actualResponse.headers['location']).toBe(
        '/problems/1?tab=statement',
      );
      expect(findSessionCookie(actualResponse)).toMatch(/HttpOnly/);
    });

    it.each([
      '//evil.com',
      'https://evil.com',
      '/\\evil.com',
      '/\t/evil.com',
      'problems/1',
    ])(
      'ignores the off-site or malformed next %j and lands on /',
      async (inputNext) => {
        // Given a crafted sign-in link pointing somewhere else
        const inputDevice = createDevice();
        // When a student signs in with Google through it
        const actualResponse = await signInWithGoogle(
          inputDevice,
          { email: STUDENT_EMAIL },
          inputNext,
        );
        // Then they still sign in, but land on the start page
        expect(actualResponse.status).toBe(302);
        expect(actualResponse.headers['location']).toBe('/');
        expect(findSessionCookie(actualResponse)).toMatch(/HttpOnly/);
      },
    );

    it('signs a returning User into the same account', async () => {
      // Given a student who signed in and set up Credentials on one device
      const firstDevice = createDevice();
      await signInWithGoogle(firstDevice, { email: STUDENT_EMAIL });
      await setupCredentials(firstDevice, 'somchai_k').expect(200);
      // When they sign in with Google again on another device
      const secondDevice = createDevice();
      await signInWithGoogle(secondDevice, { email: STUDENT_EMAIL });
      // Then it is the same User: setup is already done
      await expectErrorCode(
        setupCredentials(secondDevice, 'other_name'),
        409,
        'SETUP_ALREADY_DONE',
      );
    });

    it('sends a callback whose state does not match the cookie to /login?error=LOGIN_EXPIRED', async () => {
      // Given a device that started sign-in
      const inputDevice = createDevice();
      e2e.google.registerCode('good-code', { email: STUDENT_EMAIL });
      await startGoogleSignIn(inputDevice);
      // When the callback carries a forged state
      const actualResponse = await inputDevice
        .get('/api/auth/google/callback')
        .query({ code: 'good-code', state: 'forged-state' });
      // Then they are sent back to /login with LOGIN_EXPIRED and get no session
      expectLoginError(actualResponse, 'LOGIN_EXPIRED');
    });

    it('sends a callback on a device that never started sign-in to /login?error=LOGIN_EXPIRED', async () => {
      // Given a state obtained on another device
      e2e.google.registerCode('good-code', { email: STUDENT_EMAIL });
      const state = await startGoogleSignIn(createDevice());
      // When a fresh device replays it
      const actualResponse = await createDevice()
        .get('/api/auth/google/callback')
        .query({ code: 'good-code', state });
      // Then they are sent back to /login with LOGIN_EXPIRED and get no session
      expectLoginError(actualResponse, 'LOGIN_EXPIRED');
    });

    it('sends a code Google does not recognise to /login?error=LOGIN_EXPIRED', async () => {
      // Given a device that started sign-in
      const inputDevice = createDevice();
      const state = await startGoogleSignIn(inputDevice);
      // When the callback carries a code Google does not know
      const actualResponse = await inputDevice
        .get('/api/auth/google/callback')
        .query({ code: 'unknown-code', state });
      // Then they are sent back to /login with LOGIN_EXPIRED and get no session
      expectLoginError(actualResponse, 'LOGIN_EXPIRED');
    });

    it('sends a callback without a code (sign-in cancelled at Google) to /login?error=LOGIN_EXPIRED', async () => {
      // Given a device that started sign-in
      const inputDevice = createDevice();
      const state = await startGoogleSignIn(inputDevice);
      // When the student cancels on Google's consent screen
      const actualResponse = await inputDevice
        .get('/api/auth/google/callback')
        .query({ error: 'access_denied', state });
      // Then they are sent back to /login with LOGIN_EXPIRED and get no session
      expectLoginError(actualResponse, 'LOGIN_EXPIRED');
    });

    it('signs in a verified @kmutnb.ac.th account as a Student', async () => {
      // Given a verified staff University account
      const inputDevice = createDevice();
      // When they sign in with Google
      const actualResponse = await signInWithGoogle(inputDevice, {
        email: 'Staff@KMUTNB.AC.TH',
        name: 'Staff Person',
      });
      // Then they are a Student and can finish Credential setup
      expect(actualResponse.status).toBe(302);
      expect(findSessionCookie(actualResponse)).toMatch(/HttpOnly/);
      const { body: actualUser } = (await setupCredentials(
        inputDevice,
        'staff_k',
      ).expect(200)) as { body: unknown };
      expect(actualUser).toMatchObject({
        email: 'Staff@KMUTNB.AC.TH',
        name: 'Staff Person',
        role: 'STUDENT',
      });
    });

    it.each(['outsider@gmail.com', 'student@email.kmutnb.ac.th.evil.com'])(
      'sends the non-university email %s to /login?error=DOMAIN_NOT_ALLOWED',
      async (inputEmail) => {
        // Given a Google account outside the university domains
        // When someone signs in with a non-university Google account
        const inputDevice = createDevice();
        const actualResponse = await signInWithGoogle(inputDevice, {
          email: inputEmail,
        });
        // Then they are sent back to /login with DOMAIN_NOT_ALLOWED and get no session
        expectLoginError(actualResponse, 'DOMAIN_NOT_ALLOWED');
      },
    );

    it('sends a university email Google has not verified to /login?error=EMAIL_NOT_VERIFIED', async () => {
      // Given a university email that Google has not verified
      const inputDevice = createDevice();
      // When they try to sign in with Google
      const actualResponse = await signInWithGoogle(inputDevice, {
        email: STUDENT_EMAIL,
        email_verified: false,
      });
      // Then they are sent back to /login with EMAIL_NOT_VERIFIED and get no session
      expectLoginError(actualResponse, 'EMAIL_NOT_VERIFIED');
    });
  });

  describe('Credential setup', () => {
    it('sets the username and stamps credentialsSetAt with the server clock', async () => {
      // Given a signed-in student, three days after the clock started
      const inputDevice = createDevice();
      await signInWithGoogle(inputDevice, { email: STUDENT_EMAIL });
      e2e.clock.advance(THREE_DAYS_MS);
      // When they finish Credential setup
      const { body: actualUser } = (await setupCredentials(
        inputDevice,
        'somchai_k',
      ).expect(200)) as { body: unknown };
      // Then the setup time is the server's (moved) clock, not the wall clock
      expect(actualUser).toMatchObject({
        username: 'somchai_k',
        credentialsSetAt: '2026-11-04T09:00:00.000Z',
      });
      expect(actualUser).not.toHaveProperty('passwordHash');
    });

    it('401 NOT_SIGNED_IN without a session', async () => {
      // Given a device with no session
      // When it tries to finish Credential setup
      // Then it is refused
      await expectErrorCode(
        setupCredentials(createDevice(), 'somchai_k'),
        401,
        'NOT_SIGNED_IN',
      );
    });

    it('409 USERNAME_TAKEN when another User has the username', async () => {
      // Given another student already took "somchai_k"
      await createUserWithCredentials(OTHER_STUDENT_EMAIL, 'somchai_k');
      const inputDevice = createDevice();
      await signInWithGoogle(inputDevice, { email: STUDENT_EMAIL });
      // When this student picks the same username
      // Then it is refused, and a free username still works afterwards
      await expectErrorCode(
        setupCredentials(inputDevice, 'somchai_k'),
        409,
        'USERNAME_TAKEN',
      );
      await setupCredentials(inputDevice, 'somchai_2').expect(200);
    });

    it('409 SETUP_ALREADY_DONE on a second setup', async () => {
      // Given a User who already finished Credential setup
      const inputDevice = createDevice();
      await signInWithGoogle(inputDevice, { email: STUDENT_EMAIL });
      await setupCredentials(inputDevice, 'somchai_k').expect(200);
      // When they try to set Credentials again
      // Then it is refused
      await expectErrorCode(
        setupCredentials(inputDevice, 'somchai_new'),
        409,
        'SETUP_ALREADY_DONE',
      );
    });

    it('400 for a username with capitals', async () => {
      // Given a User signed in with Google who has not finished Credential setup
      const inputDevice = createDevice();
      await signInWithGoogle(inputDevice, { email: STUDENT_EMAIL });
      // When they choose a username with capitals
      // Then it is refused
      await setupCredentials(inputDevice, 'Somchai_K').expect(400);
    });
  });

  describe('Credential setup gate', () => {
    it('a new User signed in with Google gets 403 CREDENTIAL_SETUP_REQUIRED on a gated route', async () => {
      // Given a new User who signed in with Google and has not finished Credential setup
      const inputDevice = createDevice();
      await signInWithGoogle(inputDevice, { email: STUDENT_EMAIL });
      // When they call a route other than who am I, Credential setup, or logout
      // Then the server refuses until Credential setup is done
      await expectErrorCode(
        inputDevice.get('/api/auth/google'),
        403,
        'CREDENTIAL_SETUP_REQUIRED',
      );
    });

    it('GET /auth/me, POST /auth/setup and POST /auth/logout work before setup', async () => {
      // Given a new User who has not finished Credential setup
      const inputDevice = createDevice();
      await signInWithGoogle(inputDevice, { email: STUDENT_EMAIL });
      // When they call who am I and logout
      // Then who am I and logout still work
      const me = await inputDevice.get('/api/auth/me').expect(200);
      expect(me.body).toMatchObject({
        email: STUDENT_EMAIL,
        credentialsSetAt: null,
      });
      await inputDevice.post('/api/auth/logout').expect(204);
      // And Credential setup still works on the next sign-in
      await signInWithGoogle(inputDevice, { email: STUDENT_EMAIL });
      await setupCredentials(inputDevice, 'somchai_k').expect(200);
    });

    it('after setup the response sets a new ngg.sid, the old cookie gets 401, and gated routes work with the new one', async () => {
      // Given a new User signed in with Google
      const inputDevice = createDevice();
      const signIn = await signInWithGoogle(inputDevice, {
        email: STUDENT_EMAIL,
      });
      const inputOldCookie = findSessionCookie(signIn)!.split(';')[0];
      // When they finish Credential setup
      const setupResponse = await setupCredentials(
        inputDevice,
        'somchai_k',
      ).expect(200);
      const newCookie = findSessionCookie(setupResponse)!.split(';')[0];
      // Then the response sets a different session cookie
      expect(findSessionCookie(setupResponse)).toMatch(/HttpOnly/);
      expect(newCookie).not.toBe(inputOldCookie);
      // And the old cookie is no longer a session
      const replay = await request(e2e.webHost)
        .get('/api/auth/me')
        .set('Cookie', inputOldCookie);
      expect(replay.status).toBe(401);
      expect(replay.body).toMatchObject({ code: 'NOT_SIGNED_IN' });
      // And the new cookie is past the gate
      await inputDevice.get('/api/auth/google').expect(200);
    });

    it('a User who finished setup earlier is not gated after signing in again', async () => {
      // Given a User who finished Credential setup on an earlier visit
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      // When they sign in again with Google
      const googleDevice = createDevice();
      await signInWithGoogle(googleDevice, { email: STUDENT_EMAIL });
      // Then a gated route works
      await googleDevice.get('/api/auth/google').expect(200);
      // And the same is true after a password sign-in
      const passwordDevice = createDevice();
      await passwordDevice
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
      await passwordDevice.get('/api/auth/google').expect(200);
    });
  });

  describe('Password login', () => {
    beforeEach(async () => {
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
    });

    it('signs in, sets ngg.sid and returns the User', async () => {
      // Given a new device
      const inputDevice = createDevice();
      // When the student signs in with their Credentials
      const actualResponse = await inputDevice
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD });
      // Then they get the User and a working session on this device
      expect(actualResponse.status).toBe(200);
      expect(actualResponse.body).toMatchObject({
        email: STUDENT_EMAIL,
        username: 'somchai_k',
      });
      expect(actualResponse.body).not.toHaveProperty('passwordHash');
      expect(findSessionCookie(actualResponse)).toMatch(/HttpOnly/);
      await expectErrorCode(
        setupCredentials(inputDevice, 'whatever'),
        409,
        'SETUP_ALREADY_DONE',
      );
    });

    it.each([
      ['a wrong password', 'somchai_k', 'wrong-password'],
      ['an unknown username', 'nobody_here', PASSWORD],
    ])(
      '401 INVALID_CREDENTIALS for %s',
      async (_case, inputUsername, inputPassword) => {
        // Given a User with Credentials
        // When the username or the password does not match
        const actualResponse = await createDevice()
          .post('/api/auth/login')
          .send({ username: inputUsername, password: inputPassword });
        // Then it is refused and no session is set
        expect(actualResponse.status).toBe(401);
        expect(actualResponse.body).toMatchObject({
          code: 'INVALID_CREDENTIALS',
        });
        expect(findSessionCookie(actualResponse)).toBeUndefined();
      },
    );

    it('matches the username exactly: different capitals are 401 INVALID_CREDENTIALS', async () => {
      // Given the User somchai_k
      // When someone signs in as Somchai_K with the right password
      const actualResponse = await createDevice()
        .post('/api/auth/login')
        .send({ username: 'Somchai_K', password: PASSWORD });
      // Then it is refused like any wrong username
      expect(actualResponse.status).toBe(401);
      expect(actualResponse.body).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect(findSessionCookie(actualResponse)).toBeUndefined();
    });
  });

  describe('Login rate limit', () => {
    /** One failed password sign-in as `username` from a fresh device on the shared lab IP. */
    const failLogin = (username: string): Test =>
      createDevice()
        .post('/api/auth/login')
        .send({ username, password: 'wrong-password' });

    beforeEach(async () => {
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
    });

    it('the 6th failed try on one username within a minute is 429 TOO_MANY_ATTEMPTS with retryAfterSec', async () => {
      // Given 5 failed tries on somchai_k
      for (let i = 0; i < 5; i++) await failLogin('somchai_k').expect(401);
      // When a 6th try comes in, even with the right password
      const actualResponse = await createDevice()
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD });
      // Then it is refused with how long to wait
      expect(actualResponse.status).toBe(429);
      expect(actualResponse.body).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
      const { retryAfterSec } = actualResponse.body as {
        retryAfterSec: number;
      };
      expect(retryAfterSec).toBeGreaterThan(0);
      expect(retryAfterSec).toBeLessThanOrEqual(60);
      expect(findSessionCookie(actualResponse)).toBeUndefined();
    });

    it('case variants of one username share the same counter', async () => {
      // Given 5 failed tries spread over capitalisations of somchai_k
      for (const inputUsername of [
        'somchai_k',
        'Somchai_K',
        'SOMCHAI_K',
        'somchai_K',
        'Somchai_k',
      ]) {
        await failLogin(inputUsername).expect(401);
      }
      // When the real username tries again
      // Then it is already over the limit
      await expectErrorCode(
        createDevice()
          .post('/api/auth/login')
          .send({ username: 'somchai_k', password: PASSWORD }),
        429,
        'TOO_MANY_ATTEMPTS',
      );
    });

    it('failed tries on one username do not block a different username from the same IP', async () => {
      // Given another student in the same lab, and somchai_k locked out
      await createUserWithCredentials(OTHER_STUDENT_EMAIL, 'malee_s');
      for (let i = 0; i < 5; i++) await failLogin('somchai_k').expect(401);
      await failLogin('somchai_k').expect(429);
      // When the other student signs in from the same IP
      // Then they get in
      await createDevice()
        .post('/api/auth/login')
        .send({ username: 'malee_s', password: PASSWORD })
        .expect(200);
    });

    it('the 101st try within a minute from one IP is 429, whatever the username', async () => {
      // Given 100 failed tries from one IP, each on a different username
      const actualStatuses = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          failLogin(`student_${i}`).then(({ status }) => status),
        ),
      );
      expect(new Set(actualStatuses)).toEqual(new Set([401]));
      // When a fresh username tries from the same IP, even with the right password
      // Then the IP is over its limit
      const actualResponse = await createDevice()
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD });
      expect(actualResponse.status).toBe(429);
      expect(actualResponse.body).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
      expect(actualResponse.body).toHaveProperty('retryAfterSec');
    }, 60_000);
  });

  describe('One session per User', () => {
    const procedure = readFileSync(
      join(__dirname, '../../../docs/ops/end-user-session.md'),
      'utf8',
    );

    /** The JSON body of a 200 response, typed loosely for assertions. */
    async function readBody(pending: Test): Promise<unknown> {
      const actualResponse = (await pending.expect(200)) as { body: unknown };
      return actualResponse.body;
    }
    async function signInWithPassword(username: string): Promise<TestAgent> {
      const inputDevice = createDevice();
      await inputDevice
        .post('/api/auth/login')
        .send({ username, password: PASSWORD })
        .expect(200);
      return inputDevice;
    }

    it('GET /auth/me returns the User when signed in and 401 when not', async () => {
      // Given no session
      await expectErrorCode(
        createDevice().get('/api/auth/me'),
        401,
        'NOT_SIGNED_IN',
      );
      // When a User signs in with Google and then finishes Credential setup
      const inputDevice = createDevice();
      await signInWithGoogle(inputDevice, {
        email: STUDENT_EMAIL,
        name: 'Somchai K.',
      });
      // Then who am I shows that User, and the username after Credential setup
      const actualUser = await readBody(inputDevice.get('/api/auth/me'));
      expect(actualUser).toMatchObject({
        email: STUDENT_EMAIL,
        name: 'Somchai K.',
        role: 'STUDENT',
        username: null,
        credentialsSetAt: null,
      });
      expect(actualUser).not.toHaveProperty('passwordHash');
      await setupCredentials(inputDevice, 'somchai_k').expect(200);
      const actualAfterSetup = await readBody(inputDevice.get('/api/auth/me'));
      expect(actualAfterSetup).toMatchObject({
        username: 'somchai_k',
        credentialsSetAt: expect.any(String) as unknown,
      });
    });

    it('signing in with Google on device B ends device A', async () => {
      // Given a User signed in with Google on device A
      const inputDeviceA = createDevice();
      await signInWithGoogle(inputDeviceA, { email: STUDENT_EMAIL });
      // When they sign in with Google on device B
      const inputDeviceB = createDevice();
      await signInWithGoogle(inputDeviceB, { email: STUDENT_EMAIL });
      // Then device A is signed out and device B works
      await expectErrorCode(
        inputDeviceA.get('/api/auth/me'),
        401,
        'NOT_SIGNED_IN',
      );
      const actualUser = await readBody(inputDeviceB.get('/api/auth/me'));
      expect(actualUser).toMatchObject({ email: STUDENT_EMAIL });
    });

    it('signing in with a password on device B ends device A', async () => {
      // Given a User with Credentials
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      // When they sign in with the password on device A and then on device B
      const inputDeviceA = await signInWithPassword('somchai_k');
      const inputDeviceB = await signInWithPassword('somchai_k');
      // Then device A is signed out and device B works
      await expectErrorCode(
        inputDeviceA.get('/api/auth/me'),
        401,
        'NOT_SIGNED_IN',
      );
      const actualUser = await readBody(inputDeviceB.get('/api/auth/me'));
      expect(actualUser).toMatchObject({ username: 'somchai_k' });
    });

    it('two racing password sign-ins leave one live session', async () => {
      // Given a User with Credentials and two devices
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const inputDeviceA = createDevice();
      const inputDeviceB = createDevice();
      // When both devices sign in with the password at the same time
      await Promise.all([
        inputDeviceA
          .post('/api/auth/login')
          .send({ username: 'somchai_k', password: PASSWORD }),
        inputDeviceB
          .post('/api/auth/login')
          .send({ username: 'somchai_k', password: PASSWORD }),
      ]);
      const [meA, meB] = await Promise.all([
        inputDeviceA.get('/api/auth/me'),
        inputDeviceB.get('/api/auth/me'),
      ]);
      // Then exactly one session is alive
      const actualSuccesses = [meA, meB].filter(
        (actualResponse) => actualResponse.status === 200,
      );
      expect(actualSuccesses).toHaveLength(1);
    });

    it('logout clears ngg.sid and the old cookie gets 401', async () => {
      // Given a User signed in with their password
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const inputDevice = createDevice();
      const loginResponse = await inputDevice
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
      const inputOldCookie = findSessionCookie(loginResponse)!.split(';')[0];
      // When they log out
      const logoutResponse = await inputDevice
        .post('/api/auth/logout')
        .expect(204);
      // Then ngg.sid is cleared and the old cookie gets 401
      expect(findSessionCookie(logoutResponse)).toMatch(/^ngg\.sid=;/);
      const setCookie = ([] as string[])
        .concat(logoutResponse.headers['set-cookie'] ?? [])
        .join('\n');
      expect(setCookie).not.toContain(EXAMINEE_SESSION_COOKIE_NAME);
      await expectErrorCode(
        inputDevice.get('/api/auth/me'),
        401,
        'NOT_SIGNED_IN',
      );
      const replay = await request(e2e.webHost)
        .get('/api/auth/me')
        .set('Cookie', inputOldCookie);
      expect(replay.status).toBe(401);
      expect(replay.body).toMatchObject({ code: 'NOT_SIGNED_IN' });
    });

    it('a kind EXAMINEE session behind ngg.sid gets 401', async () => {
      // Given an Examinee session stored behind ngg.sid
      const cookieId = await e2e.app.get(SessionsService).createSession({
        kind: 'EXAMINEE',
        id: 7,
        user: {
          id: 7,
          email: STUDENT_EMAIL,
          name: 'Examinee',
          avatarUrl: '',
          role: 'STUDENT',
        },
        credentialsSetAt: null,
        startedBy: 'PASSWORD',
        lastLoginAt: null,
      });
      // When who am I is called with that cookie
      const actualResponse = await request(e2e.webHost)
        .get('/api/auth/me')
        .set('Cookie', `ngg.sid=${cookieId}`);
      // Then it is refused
      expect(actualResponse.status).toBe(401);
      expect(actualResponse.body).toMatchObject({ code: 'NOT_SIGNED_IN' });
    });

    it('ignores the reserved ngg.exam.sid cookie', async () => {
      // Given a request that sends only the reserved Examinee cookie
      // When who am I is called
      // Then it is refused
      await expectErrorCode(
        request(e2e.webHost)
          .get('/api/auth/me')
          .set('Cookie', `${EXAMINEE_SESSION_COOKIE_NAME}=not-a-user-session`),
        401,
        'NOT_SIGNED_IN',
      );
    });

    it('the Role-change procedure ends the session and the next sign-in has the new Role', async () => {
      // Given a signed-in Student and the documented Redis steps
      expect(procedure).toContain('GET ngg:session:pointer:USER:<id>');
      expect(procedure).toContain('DEL ngg:session:<cookie-id>');
      expect(procedure).toContain('DEL ngg:session:pointer:USER:<id>');
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const inputDevice = await signInWithPassword('somchai_k');
      const actualBefore = (await readBody(
        inputDevice.get('/api/auth/me'),
      )) as {
        id: number;
      };
      expect(actualBefore).toMatchObject({ role: 'STUDENT' });
      // When a developer changes the Role and deletes the session by those steps
      await e2e.app
        .get(PrismaService)
        .User.where({ id: actualBefore.id })
        .update({
          role: 'TEACHER',
        });
      const actualStillOld = await readBody(inputDevice.get('/api/auth/me'));
      expect(actualStillOld).toMatchObject({ role: 'STUDENT' });
      const redis = e2e.app.get(Redis);
      const inputPointerKey = `ngg:session:pointer:USER:${actualBefore.id}`;
      const cookieId = await redis.get(inputPointerKey);
      if (!cookieId) throw new Error('procedure GET returned nil');
      await redis.del(`ngg:session:${cookieId}`);
      await redis.del(inputPointerKey);
      // Then the old session is over and the next sign-in has the new Role
      await expectErrorCode(
        inputDevice.get('/api/auth/me'),
        401,
        'NOT_SIGNED_IN',
      );
      await inputDevice
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
      const actualUser = await readBody(inputDevice.get('/api/auth/me'));
      expect(actualUser).toMatchObject({ role: 'TEACHER' });
    });

    it('loads the User session once per request across guards and route handlers', async () => {
      // Given a signed-in Google session that has finished Credential setup
      const inputDevice = createDevice();
      await signInWithGoogle(inputDevice, { email: STUDENT_EMAIL });
      await setupCredentials(inputDevice, 'somchai_k').expect(200);
      const mockFindSession = jest.spyOn(
        e2e.app.get(SessionsService),
        'findCurrentUserSession',
      );
      try {
        // When the User hits a route checked by both guards and the service
        await inputDevice
          .post('/api/auth/password/reset')
          .send({ newPassword: 'newpassword456' })
          .expect(204);
        // Then the session is loaded from Redis only once for that request
        expect(mockFindSession).toHaveBeenCalledTimes(1);
        mockFindSession.mockClear();
        // And a regular guarded route also loads the session once
        await inputDevice
          .patch('/api/auth/username')
          .send({ username: 'somchai_new' })
          .expect(200);
        expect(mockFindSession).toHaveBeenCalledTimes(1);
      } finally {
        mockFindSession.mockRestore();
      }
    });
  });

  describe('Changing the username', () => {
    /** Signs in with `username` and the shared password and returns that device. */
    async function signInWithPassword(username: string): Promise<TestAgent> {
      const inputDevice = createDevice();
      await inputDevice
        .post('/api/auth/login')
        .send({ username, password: PASSWORD })
        .expect(200);
      return inputDevice;
    }

    /** PATCH /auth/username on `inputDevice`. */
    const changeUsername = (inputDevice: TestAgent, username: string): Test =>
      inputDevice.patch('/api/auth/username').send({ username });

    it('renames: login works with the new username and fails with the old one', async () => {
      // Given a User signed in as "somchai_k"
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const inputDevice = await signInWithPassword('somchai_k');
      // When they rename to "somchai_new"
      const { body: actualUser } = (await changeUsername(
        inputDevice,
        'somchai_new',
      ).expect(200)) as { body: unknown };
      // Then the response and the database carry the new username
      expect(actualUser).toMatchObject({
        email: STUDENT_EMAIL,
        username: 'somchai_new',
      });
      expect(actualUser).not.toHaveProperty('passwordHash');
      // And the old username no longer signs in, the new one does
      await expectErrorCode(
        createDevice()
          .post('/api/auth/login')
          .send({ username: 'somchai_k', password: PASSWORD }),
        401,
        'INVALID_CREDENTIALS',
      );
      await signInWithPassword('somchai_new');
    });

    it('the current session keeps working after the rename', async () => {
      // Given a User signed in as "somchai_k"
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const inputDevice = await signInWithPassword('somchai_k');
      // When they rename
      await changeUsername(inputDevice, 'somchai_new').expect(200);
      // Then the same cookie still works and shows the new username
      const actualMe = await inputDevice.get('/api/auth/me').expect(200);
      expect(actualMe.body).toMatchObject({ username: 'somchai_new' });
      // And they can rename again (no limit)
      await changeUsername(inputDevice, 'somchai_3').expect(200);
    });

    it('409 USERNAME_TAKEN when another User has the username', async () => {
      // Given two Users, "somchai_k" and "other_one"
      await createUserWithCredentials(OTHER_STUDENT_EMAIL, 'other_one');
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const inputDevice = await signInWithPassword('somchai_k');
      // When "somchai_k" tries to take "other_one"
      await expectErrorCode(
        changeUsername(inputDevice, 'other_one'),
        409,
        'USERNAME_TAKEN',
      );
      // Then nothing changed
      await signInWithPassword('somchai_k');
    });

    it.each(['Somchai_K', 'som-chai', 'abc', 'a'.repeat(21), 'สมชาย_k'])(
      '400 for the invalid username %s',
      async (inputUsername) => {
        // Given a User signed in as "somchai_k"
        await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
        const inputDevice = await signInWithPassword('somchai_k');
        // When they pick a username that breaks the setup rules
        await changeUsername(inputDevice, inputUsername).expect(400);
        // Then the old username still signs in
        await signInWithPassword('somchai_k');
      },
    );

    it('another User can take the old username right after the rename', async () => {
      // Given "somchai_k" renamed to "somchai_new"
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const inputDevice = await signInWithPassword('somchai_k');
      await changeUsername(inputDevice, 'somchai_new').expect(200);
      // When another User sets up Credentials with "somchai_k"
      // Then it is free
      await createUserWithCredentials(OTHER_STUDENT_EMAIL, 'somchai_k');
    });

    it('two Users swapping usernames at the same time never both win and never 500', async () => {
      // Given two Users, "user_a" and "user_b"
      await createUserWithCredentials(STUDENT_EMAIL, 'user_a');
      await createUserWithCredentials(OTHER_STUDENT_EMAIL, 'user_b');
      const inputDeviceA = await signInWithPassword('user_a');
      const inputDeviceB = await signInWithPassword('user_b');
      // When each takes the other's username at the same moment
      const [actualA, actualB] = await Promise.all([
        changeUsername(inputDeviceA, 'user_b'),
        changeUsername(inputDeviceB, 'user_a'),
      ]);
      // Then each request is either 200 or 409 USERNAME_TAKEN, never a server error
      for (const actual of [actualA, actualB]) {
        expect([200, 409]).toContain(actual.status);
        if (actual.status === 409) {
          expect(actual.body).toMatchObject({ code: 'USERNAME_TAKEN' });
        }
      }
      // And the two usernames are still different
      const [meA, meB] = await Promise.all([
        inputDeviceA.get('/api/auth/me').expect(200),
        inputDeviceB.get('/api/auth/me').expect(200),
      ]);
      const { username: actualUsernameA } = meA.body as { username: string };
      const { username: actualUsernameB } = meB.body as { username: string };
      expect(actualUsernameA).not.toBe(actualUsernameB);
    });

    it('401 NOT_SIGNED_IN without a session', async () => {
      // Given a device with no session
      // When it tries to change a username
      // Then it is refused
      await expectErrorCode(
        changeUsername(createDevice(), 'somchai_new'),
        401,
        'NOT_SIGNED_IN',
      );
    });

    it('refuses a username change before Credential setup', async () => {
      // Given a Google session that has not finished Credential setup
      const inputDevice = createDevice();
      await signInWithGoogle(inputDevice, { email: STUDENT_EMAIL });
      // When they try to change the username
      // Then the setup gate refuses it
      await expectErrorCode(
        changeUsername(inputDevice, 'somchai_new'),
        403,
        'CREDENTIAL_SETUP_REQUIRED',
      );
    });
  });

  describe('Changing and resetting a password', () => {
    const NEW_PASSWORD = 'new-password-456';
    const TEN_MINUTES_MS = 10 * 60 * 1000;

    /** Signs in with the shared password and returns that device. */
    async function signInWithPassword(): Promise<TestAgent> {
      const inputDevice = createDevice();
      await inputDevice
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
      return inputDevice;
    }

    /** The old password is refused at login and the new one signs in. */
    async function expectPasswordSwapped(): Promise<void> {
      const actualOldLogin = await createDevice()
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD });
      expect(actualOldLogin.status).toBe(401);
      expect(actualOldLogin.body).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      await createDevice()
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: NEW_PASSWORD })
        .expect(200);
    }

    it('change with the right current password: old fails, new works, this session stays', async () => {
      // Given a User signed in with their password
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const inputDevice = await signInWithPassword();
      // When they change it
      await inputDevice
        .post('/api/auth/password')
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(204);
      // Then this cookie still works, the old password fails, and the new one works
      await inputDevice.get('/api/auth/me').expect(200);
      await expectPasswordSwapped();
    });

    it('change with a wrong current password is 401 and leaves the password as it was', async () => {
      // Given a User signed in with their password
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const inputDevice = await signInWithPassword();
      // When they send the wrong current password
      await expectErrorCode(
        inputDevice.post('/api/auth/password').send({
          currentPassword: 'wrong-password',
          newPassword: NEW_PASSWORD,
        }),
        401,
        'INVALID_CREDENTIALS',
      );
      // Then this session stays and the password is unchanged
      await inputDevice.get('/api/auth/me').expect(200);
      await createDevice()
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
      const actualNewLogin = await createDevice()
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: NEW_PASSWORD });
      expect(actualNewLogin.status).toBe(401);
      expect(actualNewLogin.body).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('rejects a new password outside the setup length rules and leaves the old one', async () => {
      // Given a User signed in with their password
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const inputDevice = await signInWithPassword();
      const inputTooLong = 'a'.repeat(73);
      // When the new password is shorter than 8 or longer than 72
      await inputDevice
        .post('/api/auth/password')
        .send({ currentPassword: PASSWORD, newPassword: 'short' })
        .expect(400);
      await inputDevice
        .post('/api/auth/password')
        .send({ currentPassword: PASSWORD, newPassword: inputTooLong })
        .expect(400);
      // Then the old password still signs in
      await createDevice()
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
    });

    it('refuses a password change before Credential setup', async () => {
      // Given a Google session that has not finished Credential setup
      const inputDevice = createDevice();
      await signInWithGoogle(inputDevice, { email: STUDENT_EMAIL });
      // When they try to change the password
      await expectErrorCode(
        inputDevice.post('/api/auth/password').send({
          currentPassword: PASSWORD,
          newPassword: NEW_PASSWORD,
        }),
        403,
        'CREDENTIAL_SETUP_REQUIRED',
      );
    });

    it('reset within 10 minutes of a Google sign-in works without the old password', async () => {
      // Given a session started by Google, Credential setup just finished
      const inputDevice = createDevice();
      await signInWithGoogle(inputDevice, { email: STUDENT_EMAIL });
      await setupCredentials(inputDevice, 'somchai_k').expect(200);
      // When they set a new password without the old one
      await inputDevice
        .post('/api/auth/password/reset')
        .send({ newPassword: NEW_PASSWORD })
        .expect(204);
      // Then this session stays, the old password fails, and the new one works
      await inputDevice.get('/api/auth/me').expect(200);
      await expectPasswordSwapped();
    });

    it('reset 10 minutes after the Google sign-in is 403 and leaves the password', async () => {
      // Given a Google session whose sign-in is now 10 minutes ago
      const inputDevice = createDevice();
      await signInWithGoogle(inputDevice, { email: STUDENT_EMAIL });
      await setupCredentials(inputDevice, 'somchai_k').expect(200);
      e2e.clock.advance(TEN_MINUTES_MS);
      // When they try to reset
      await expectErrorCode(
        inputDevice
          .post('/api/auth/password/reset')
          .send({ newPassword: NEW_PASSWORD }),
        403,
        'RECENT_GOOGLE_SIGN_IN_REQUIRED',
      );
      // Then the password is unchanged
      await createDevice()
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
    });

    it('rejects a reset password outside the setup length rules', async () => {
      // Given a fresh Google session
      const inputDevice = createDevice();
      await signInWithGoogle(inputDevice, { email: STUDENT_EMAIL });
      await setupCredentials(inputDevice, 'somchai_k').expect(200);
      const inputTooLong = 'a'.repeat(73);
      // When the new password is shorter than 8 or longer than 72
      await inputDevice
        .post('/api/auth/password/reset')
        .send({ newPassword: 'short' })
        .expect(400);
      await inputDevice
        .post('/api/auth/password/reset')
        .send({ newPassword: inputTooLong })
        .expect(400);
      // Then the old password still signs in
      await createDevice()
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
    });

    it('refuses a password reset before Credential setup', async () => {
      // Given a Google session that has not finished Credential setup
      const inputDevice = createDevice();
      await signInWithGoogle(inputDevice, { email: STUDENT_EMAIL });
      // When they try to reset
      await expectErrorCode(
        inputDevice
          .post('/api/auth/password/reset')
          .send({ newPassword: NEW_PASSWORD }),
        403,
        'CREDENTIAL_SETUP_REQUIRED',
      );
    });

    it('reset from a session started with a password is 403', async () => {
      // Given a session started with a password
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const inputDevice = await signInWithPassword();
      // When they try to reset without the old password
      await expectErrorCode(
        inputDevice
          .post('/api/auth/password/reset')
          .send({ newPassword: NEW_PASSWORD }),
        403,
        'RECENT_GOOGLE_SIGN_IN_REQUIRED',
      );
      // Then the password is unchanged
      await createDevice()
        .post('/api/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
    });
  });
});
