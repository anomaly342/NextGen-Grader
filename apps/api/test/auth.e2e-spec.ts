import request, { type Response, type Test } from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { createE2eApp } from './support/e2e-app.util';
import { E2E_WEB_URL } from './support/e2e-env.constants';
import type { E2eApp } from './support/interfaces/e2e-app.interface';
import type { FakeGoogleProfile } from './support/interfaces/fake-google-profile.interface';

const STUDENT_EMAIL = 's6601012345678@email.kmutnb.ac.th';
const OTHER_STUDENT_EMAIL = 's6601098765432@email.kmutnb.ac.th';
const PASSWORD = 'password123';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

describe('Auth (e2e)', () => {
  let e2e: E2eApp;

  /** A browser: keeps its own cookies, like one device in the lab. */
  const createDevice = (): TestAgent => request.agent(e2e.app.getHttpServer());

  /** Starts Google sign-in on `device` and returns the `state` Google would echo back. */
  const startGoogleSignIn = async (device: TestAgent): Promise<string> => {
    const response = await device.get('/auth/google').expect(200);
    const { url } = response.body as { url: string };
    return new URL(url).searchParams.get('state')!;
  };

  /** Runs the whole Google flow on `device` as `profile`. */
  const signInWithGoogle = async (
    device: TestAgent,
    profile: FakeGoogleProfile,
  ): Promise<Response> => {
    const code = `code-for-${profile.email}`;
    e2e.google.registerCode(code, profile);
    const state = await startGoogleSignIn(device);
    return device.get('/auth/google/callback').query({ code, state });
  };

  /** Credential setup on a device that is already signed in. */
  const setupCredentials = (device: TestAgent, username: string): Test =>
    device.post('/auth/setup').send({ username, password: PASSWORD });

  /** A User who signed in with Google once and finished Credential setup. */
  const createUserWithCredentials = async (
    email: string,
    username: string,
  ): Promise<void> => {
    const device = createDevice();
    await signInWithGoogle(device, { email });
    await setupCredentials(device, username).expect(200);
  };

  /** Waits for `pending` and checks it failed with `status` and error `code`. */
  const expectErrorCode = async (
    pending: Test,
    status: number,
    code: string,
  ): Promise<void> => {
    const response = await pending.expect(status);
    expect(response.body).toMatchObject({ code });
  };

  /** The `ngg.sid` Set-Cookie header of `response`, if any. */
  const findSessionCookie = (response: Response): string | undefined =>
    ([] as string[])
      .concat(response.headers['set-cookie'] ?? [])
      .find((cookie) => cookie.startsWith('ngg.sid='));

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
    it('creates the User, sets ngg.sid and redirects to the web app', async () => {
      // Given a student with a verified university account
      const device = createDevice();
      // When they sign in with Google
      const actualResponse = await signInWithGoogle(device, {
        email: STUDENT_EMAIL,
        name: 'Somchai K.',
      });
      // Then they land on the web app with a session that knows who they are
      expect(actualResponse.status).toBe(302);
      expect(actualResponse.headers['location']).toBe(E2E_WEB_URL);
      expect(findSessionCookie(actualResponse)).toMatch(/HttpOnly/);
      const { body: actualUser } = (await setupCredentials(
        device,
        'somchai_k',
      ).expect(200)) as { body: unknown };
      expect(actualUser).toMatchObject({
        email: STUDENT_EMAIL,
        name: 'Somchai K.',
        role: 'STUDENT',
        username: 'somchai_k',
      });
    });

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

    it('rejects a callback whose state does not match the cookie', async () => {
      // Given a device that started sign-in
      const device = createDevice();
      e2e.google.registerCode('good-code', { email: STUDENT_EMAIL });
      await startGoogleSignIn(device);
      // When the callback carries a forged state
      const actualResponse = await device
        .get('/auth/google/callback')
        .query({ code: 'good-code', state: 'forged-state' });
      // Then sign-in fails and no session is set
      expect(actualResponse.status).toBe(401);
      expect(findSessionCookie(actualResponse)).toBeUndefined();
    });

    it('rejects a callback on a device that never started sign-in', async () => {
      // Given a state obtained on another device
      e2e.google.registerCode('good-code', { email: STUDENT_EMAIL });
      const state = await startGoogleSignIn(createDevice());
      // When a fresh device replays it
      const actualResponse = await createDevice()
        .get('/auth/google/callback')
        .query({ code: 'good-code', state });
      // Then sign-in fails and no session is set
      expect(actualResponse.status).toBe(401);
      expect(findSessionCookie(actualResponse)).toBeUndefined();
    });

    it('rejects a code Google does not recognise', async () => {
      const device = createDevice();
      const state = await startGoogleSignIn(device);
      const actualResponse = await device
        .get('/auth/google/callback')
        .query({ code: 'unknown-code', state });
      expect(actualResponse.status).toBe(401);
      expect(findSessionCookie(actualResponse)).toBeUndefined();
    });

    it.each(['outsider@gmail.com', 'student@email.kmutnb.ac.th.evil.com'])(
      'rejects the non-university email %s',
      async (inputEmail) => {
        // When someone signs in with a non-university Google account
        const device = createDevice();
        const actualResponse = await signInWithGoogle(device, {
          email: inputEmail,
        });
        // Then they are refused and get no session
        expect(actualResponse.status).toBe(403);
        expect(findSessionCookie(actualResponse)).toBeUndefined();
      },
    );

    it('rejects a university email that Google has not verified', async () => {
      const device = createDevice();
      const actualResponse = await signInWithGoogle(device, {
        email: STUDENT_EMAIL,
        email_verified: false,
      });
      expect(actualResponse.status).toBe(401);
      expect(findSessionCookie(actualResponse)).toBeUndefined();
    });
  });

  describe('Credential setup', () => {
    it('sets the username and stamps credentialsSetAt with the server clock', async () => {
      // Given a signed-in student, three days after the clock started
      const device = createDevice();
      await signInWithGoogle(device, { email: STUDENT_EMAIL });
      e2e.clock.advance(THREE_DAYS_MS);
      // When they finish Credential setup
      const { body: actualUser } = (await setupCredentials(
        device,
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
      await expectErrorCode(
        setupCredentials(createDevice(), 'somchai_k'),
        401,
        'NOT_SIGNED_IN',
      );
    });

    it('409 USERNAME_TAKEN when another User has the username', async () => {
      // Given another student already took "somchai_k"
      await createUserWithCredentials(OTHER_STUDENT_EMAIL, 'somchai_k');
      const device = createDevice();
      await signInWithGoogle(device, { email: STUDENT_EMAIL });
      // When this student picks the same username
      // Then it is refused, and a free username still works afterwards
      await expectErrorCode(
        setupCredentials(device, 'somchai_k'),
        409,
        'USERNAME_TAKEN',
      );
      await setupCredentials(device, 'somchai_2').expect(200);
    });

    it('409 SETUP_ALREADY_DONE on a second setup', async () => {
      const device = createDevice();
      await signInWithGoogle(device, { email: STUDENT_EMAIL });
      await setupCredentials(device, 'somchai_k').expect(200);
      await expectErrorCode(
        setupCredentials(device, 'somchai_new'),
        409,
        'SETUP_ALREADY_DONE',
      );
    });

    it('400 for a username with capitals', async () => {
      const device = createDevice();
      await signInWithGoogle(device, { email: STUDENT_EMAIL });
      await setupCredentials(device, 'Somchai_K').expect(400);
    });
  });

  describe('Password login', () => {
    beforeEach(async () => {
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
    });

    it('signs in, sets ngg.sid and returns the User', async () => {
      // Given a new device
      const device = createDevice();
      // When the student signs in with their Credentials
      const actualResponse = await device
        .post('/auth/login')
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
        setupCredentials(device, 'whatever'),
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
        const actualResponse = await createDevice()
          .post('/auth/login')
          .send({ username: inputUsername, password: inputPassword });
        expect(actualResponse.status).toBe(401);
        expect(actualResponse.body).toMatchObject({
          code: 'INVALID_CREDENTIALS',
        });
        expect(findSessionCookie(actualResponse)).toBeUndefined();
      },
    );
  });
});
