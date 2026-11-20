import request, { type Response, type Test } from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Redis } from 'ioredis';
import { PrismaService } from '@/prisma/prisma.service';
import { EXAMINEE_SESSION_COOKIE_NAME } from '@/sessions/sessions.constants';
import { SessionsService } from '@/sessions/sessions.service';
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

  describe('Credential setup gate', () => {
    it('a new User signed in with Google gets 403 CREDENTIAL_SETUP_REQUIRED on a gated route', async () => {
      // Given a new User who signed in with Google and has not finished Credential setup
      const device = createDevice();
      await signInWithGoogle(device, { email: STUDENT_EMAIL });
      // When they call a route other than who am I, Credential setup, or logout
      // Then the server refuses until Credential setup is done
      await expectErrorCode(
        device.get('/auth/google'),
        403,
        'CREDENTIAL_SETUP_REQUIRED',
      );
    });

    it('GET /auth/me, POST /auth/setup and POST /auth/logout work before setup', async () => {
      // Given a new User who has not finished Credential setup
      const device = createDevice();
      await signInWithGoogle(device, { email: STUDENT_EMAIL });
      // Then who am I and logout still work
      const me = await device.get('/auth/me').expect(200);
      expect(me.body).toMatchObject({
        email: STUDENT_EMAIL,
        credentialsSetAt: null,
      });
      await device.post('/auth/logout').expect(204);
      // And Credential setup still works on the next sign-in
      await signInWithGoogle(device, { email: STUDENT_EMAIL });
      await setupCredentials(device, 'somchai_k').expect(200);
    });

    it('after setup the response sets a new ngg.sid, the old cookie gets 401, and gated routes work with the new one', async () => {
      // Given a new User signed in with Google
      const device = createDevice();
      const signIn = await signInWithGoogle(device, { email: STUDENT_EMAIL });
      const oldCookie = findSessionCookie(signIn)!.split(';')[0];
      // When they finish Credential setup
      const setupResponse = await setupCredentials(device, 'somchai_k').expect(
        200,
      );
      const newCookie = findSessionCookie(setupResponse)!.split(';')[0];
      // Then the response sets a different session cookie
      expect(findSessionCookie(setupResponse)).toMatch(/HttpOnly/);
      expect(newCookie).not.toBe(oldCookie);
      // And the old cookie is no longer a session
      const replay = await request(e2e.app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', oldCookie);
      expect(replay.status).toBe(401);
      expect(replay.body).toMatchObject({ code: 'NOT_SIGNED_IN' });
      // And the new cookie is past the gate
      await device.get('/auth/google').expect(200);
    });

    it('a User who finished setup earlier is not gated after signing in again', async () => {
      // Given a User who finished Credential setup on an earlier visit
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      // When they sign in again with Google
      const googleDevice = createDevice();
      await signInWithGoogle(googleDevice, { email: STUDENT_EMAIL });
      // Then a gated route works
      await googleDevice.get('/auth/google').expect(200);
      // And the same is true after a password sign-in
      const passwordDevice = createDevice();
      await passwordDevice
        .post('/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
      await passwordDevice.get('/auth/google').expect(200);
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

  describe('One session per User', () => {
    const procedure = readFileSync(
      join(__dirname, '../../../docs/ops/end-user-session.md'),
      'utf8',
    );

    /** The JSON body of a 200 response, typed loosely for assertions. */
    const readBody = async (pending: Test): Promise<unknown> => {
      const response = (await pending.expect(200)) as { body: unknown };
      return response.body;
    };
    const signInWithPassword = async (username: string): Promise<TestAgent> => {
      const device = createDevice();
      await device
        .post('/auth/login')
        .send({ username, password: PASSWORD })
        .expect(200);
      return device;
    };

    it('GET /auth/me returns the User when signed in and 401 when not', async () => {
      await expectErrorCode(
        createDevice().get('/auth/me'),
        401,
        'NOT_SIGNED_IN',
      );
      const device = createDevice();
      await signInWithGoogle(device, {
        email: STUDENT_EMAIL,
        name: 'Somchai K.',
      });
      const actualUser = await readBody(device.get('/auth/me'));
      expect(actualUser).toMatchObject({
        email: STUDENT_EMAIL,
        name: 'Somchai K.',
        role: 'STUDENT',
        username: null,
        credentialsSetAt: null,
      });
      expect(actualUser).not.toHaveProperty('passwordHash');
      await setupCredentials(device, 'somchai_k').expect(200);
      const actualAfterSetup = await readBody(device.get('/auth/me'));
      expect(actualAfterSetup).toMatchObject({
        username: 'somchai_k',
        credentialsSetAt: expect.any(String) as unknown,
      });
    });

    it('signing in with Google on device B ends device A', async () => {
      const deviceA = createDevice();
      await signInWithGoogle(deviceA, { email: STUDENT_EMAIL });
      const deviceB = createDevice();
      await signInWithGoogle(deviceB, { email: STUDENT_EMAIL });
      await expectErrorCode(deviceA.get('/auth/me'), 401, 'NOT_SIGNED_IN');
      const actualUser = await readBody(deviceB.get('/auth/me'));
      expect(actualUser).toMatchObject({ email: STUDENT_EMAIL });
    });

    it('signing in with a password on device B ends device A', async () => {
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const deviceA = await signInWithPassword('somchai_k');
      const deviceB = await signInWithPassword('somchai_k');
      await expectErrorCode(deviceA.get('/auth/me'), 401, 'NOT_SIGNED_IN');
      const actualUser = await readBody(deviceB.get('/auth/me'));
      expect(actualUser).toMatchObject({ username: 'somchai_k' });
    });

    it('two racing password sign-ins leave one live session', async () => {
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const deviceA = createDevice();
      const deviceB = createDevice();
      await Promise.all([
        deviceA
          .post('/auth/login')
          .send({ username: 'somchai_k', password: PASSWORD }),
        deviceB
          .post('/auth/login')
          .send({ username: 'somchai_k', password: PASSWORD }),
      ]);
      const [meA, meB] = await Promise.all([
        deviceA.get('/auth/me'),
        deviceB.get('/auth/me'),
      ]);
      const successes = [meA, meB].filter(
        (response) => response.status === 200,
      );
      expect(successes).toHaveLength(1);
    });

    it('logout clears ngg.sid and the old cookie gets 401', async () => {
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const device = createDevice();
      const loginResponse = await device
        .post('/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
      const oldCookie = findSessionCookie(loginResponse)!.split(';')[0];
      const logoutResponse = await device.post('/auth/logout').expect(204);
      expect(findSessionCookie(logoutResponse)).toMatch(/^ngg\.sid=;/);
      const setCookie = ([] as string[])
        .concat(logoutResponse.headers['set-cookie'] ?? [])
        .join('\n');
      expect(setCookie).not.toContain(EXAMINEE_SESSION_COOKIE_NAME);
      await expectErrorCode(device.get('/auth/me'), 401, 'NOT_SIGNED_IN');
      const replay = await request(e2e.app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', oldCookie);
      expect(replay.status).toBe(401);
      expect(replay.body).toMatchObject({ code: 'NOT_SIGNED_IN' });
    });

    it('a kind EXAMINEE session behind ngg.sid gets 401', async () => {
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
      const response = await request(e2e.app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', `ngg.sid=${cookieId}`);
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'NOT_SIGNED_IN' });
    });

    it('ignores the reserved ngg.exam.sid cookie', async () => {
      await expectErrorCode(
        request(e2e.app.getHttpServer())
          .get('/auth/me')
          .set('Cookie', `${EXAMINEE_SESSION_COOKIE_NAME}=not-a-user-session`),
        401,
        'NOT_SIGNED_IN',
      );
    });

    it('the Role-change procedure ends the session and the next sign-in has the new Role', async () => {
      expect(procedure).toContain('GET ngg:session:pointer:USER:<id>');
      expect(procedure).toContain('DEL ngg:session:<cookie-id>');
      expect(procedure).toContain('DEL ngg:session:pointer:USER:<id>');
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const device = await signInWithPassword('somchai_k');
      const before = (await readBody(device.get('/auth/me'))) as {
        id: number;
      };
      expect(before).toMatchObject({ role: 'STUDENT' });
      await e2e.app.get(PrismaService).User.where({ id: before.id }).update({
        role: 'TEACHER',
      });
      const stillOld = await readBody(device.get('/auth/me'));
      expect(stillOld).toMatchObject({ role: 'STUDENT' });
      const redis = e2e.app.get(Redis);
      const pointerKey = `ngg:session:pointer:USER:${before.id}`;
      const cookieId = await redis.get(pointerKey);
      if (!cookieId) throw new Error('procedure GET returned nil');
      await redis.del(`ngg:session:${cookieId}`);
      await redis.del(pointerKey);
      await expectErrorCode(device.get('/auth/me'), 401, 'NOT_SIGNED_IN');
      await device
        .post('/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
      const actualUser = await readBody(device.get('/auth/me'));
      expect(actualUser).toMatchObject({ role: 'TEACHER' });
    });
  });

  describe('Changing the username', () => {
    /** Signs in with `username` and the shared password and returns that device. */
    const signInWithPassword = async (username: string): Promise<TestAgent> => {
      const device = createDevice();
      await device
        .post('/auth/login')
        .send({ username, password: PASSWORD })
        .expect(200);
      return device;
    };

    /** PATCH /auth/username on `device`. */
    const changeUsername = (device: TestAgent, username: string): Test =>
      device.patch('/auth/username').send({ username });

    it('renames: login works with the new username and fails with the old one', async () => {
      // Given a User signed in as "somchai_k"
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const device = await signInWithPassword('somchai_k');
      // When they rename to "somchai_new"
      const { body: actualUser } = (await changeUsername(
        device,
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
          .post('/auth/login')
          .send({ username: 'somchai_k', password: PASSWORD }),
        401,
        'INVALID_CREDENTIALS',
      );
      await signInWithPassword('somchai_new');
    });

    it('the current session keeps working after the rename', async () => {
      // Given a User signed in as "somchai_k"
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const device = await signInWithPassword('somchai_k');
      // When they rename
      await changeUsername(device, 'somchai_new').expect(200);
      // Then the same cookie still works and shows the new username
      const actualMe = await device.get('/auth/me').expect(200);
      expect(actualMe.body).toMatchObject({ username: 'somchai_new' });
      // And they can rename again (no limit)
      await changeUsername(device, 'somchai_3').expect(200);
    });

    it('409 USERNAME_TAKEN when another User has the username', async () => {
      // Given two Users, "somchai_k" and "other_one"
      await createUserWithCredentials(OTHER_STUDENT_EMAIL, 'other_one');
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const device = await signInWithPassword('somchai_k');
      // When "somchai_k" tries to take "other_one"
      await expectErrorCode(
        changeUsername(device, 'other_one'),
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
        const device = await signInWithPassword('somchai_k');
        // When they pick a username that breaks the setup rules
        await changeUsername(device, inputUsername).expect(400);
        // Then the old username still signs in
        await signInWithPassword('somchai_k');
      },
    );

    it('another User can take the old username right after the rename', async () => {
      // Given "somchai_k" renamed to "somchai_new"
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const device = await signInWithPassword('somchai_k');
      await changeUsername(device, 'somchai_new').expect(200);
      // When another User sets up Credentials with "somchai_k"
      // Then it is free
      await createUserWithCredentials(OTHER_STUDENT_EMAIL, 'somchai_k');
    });

    it('two Users swapping usernames at the same time never both win and never 500', async () => {
      // Given two Users, "user_a" and "user_b"
      await createUserWithCredentials(STUDENT_EMAIL, 'user_a');
      await createUserWithCredentials(OTHER_STUDENT_EMAIL, 'user_b');
      const deviceA = await signInWithPassword('user_a');
      const deviceB = await signInWithPassword('user_b');
      // When each takes the other's username at the same moment
      const [actualA, actualB] = await Promise.all([
        changeUsername(deviceA, 'user_b'),
        changeUsername(deviceB, 'user_a'),
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
        deviceA.get('/auth/me').expect(200),
        deviceB.get('/auth/me').expect(200),
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
      const device = createDevice();
      await signInWithGoogle(device, { email: STUDENT_EMAIL });
      // When they try to change the username
      // Then the setup gate refuses it
      await expectErrorCode(
        changeUsername(device, 'somchai_new'),
        403,
        'CREDENTIAL_SETUP_REQUIRED',
      );
    });
  });

  describe('Changing and resetting a password', () => {
    const NEW_PASSWORD = 'new-password-456';
    const TEN_MINUTES_MS = 10 * 60 * 1000;

    /** Signs in with the shared password and returns that device. */
    const signInWithPassword = async (): Promise<TestAgent> => {
      const device = createDevice();
      await device
        .post('/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
      return device;
    };

    /** The old password is refused at login and the new one signs in. */
    const expectPasswordSwapped = async (): Promise<void> => {
      const actualOldLogin = await createDevice()
        .post('/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD });
      expect(actualOldLogin.status).toBe(401);
      expect(actualOldLogin.body).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      await createDevice()
        .post('/auth/login')
        .send({ username: 'somchai_k', password: NEW_PASSWORD })
        .expect(200);
    };

    it('change with the right current password: old fails, new works, this session stays', async () => {
      // Given a User signed in with their password
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const device = await signInWithPassword();
      // When they change it
      await device
        .post('/auth/password')
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(204);
      // Then this cookie still works, the old password fails, and the new one works
      await device.get('/auth/me').expect(200);
      await expectPasswordSwapped();
    });

    it('change with a wrong current password is 401 and leaves the password as it was', async () => {
      // Given a User signed in with their password
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const device = await signInWithPassword();
      // When they send the wrong current password
      await expectErrorCode(
        device.post('/auth/password').send({
          currentPassword: 'wrong-password',
          newPassword: NEW_PASSWORD,
        }),
        401,
        'INVALID_CREDENTIALS',
      );
      // Then this session stays and the password is unchanged
      await device.get('/auth/me').expect(200);
      await createDevice()
        .post('/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
      const actualNewLogin = await createDevice()
        .post('/auth/login')
        .send({ username: 'somchai_k', password: NEW_PASSWORD });
      expect(actualNewLogin.status).toBe(401);
      expect(actualNewLogin.body).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('rejects a new password outside the setup length rules and leaves the old one', async () => {
      // Given a User signed in with their password
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const device = await signInWithPassword();
      const inputTooLong = 'a'.repeat(73);
      // When the new password is shorter than 8 or longer than 72
      await device
        .post('/auth/password')
        .send({ currentPassword: PASSWORD, newPassword: 'short' })
        .expect(400);
      await device
        .post('/auth/password')
        .send({ currentPassword: PASSWORD, newPassword: inputTooLong })
        .expect(400);
      // Then the old password still signs in
      await createDevice()
        .post('/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
    });

    it('refuses a password change before Credential setup', async () => {
      // Given a Google session that has not finished Credential setup
      const device = createDevice();
      await signInWithGoogle(device, { email: STUDENT_EMAIL });
      // When they try to change the password
      await expectErrorCode(
        device.post('/auth/password').send({
          currentPassword: PASSWORD,
          newPassword: NEW_PASSWORD,
        }),
        403,
        'CREDENTIAL_SETUP_REQUIRED',
      );
    });

    it('reset within 10 minutes of a Google sign-in works without the old password', async () => {
      // Given a session started by Google, Credential setup just finished
      const device = createDevice();
      await signInWithGoogle(device, { email: STUDENT_EMAIL });
      await setupCredentials(device, 'somchai_k').expect(200);
      // When they set a new password without the old one
      await device
        .post('/auth/password/reset')
        .send({ newPassword: NEW_PASSWORD })
        .expect(204);
      // Then this session stays, the old password fails, and the new one works
      await device.get('/auth/me').expect(200);
      await expectPasswordSwapped();
    });

    it('reset 10 minutes after the Google sign-in is 403 and leaves the password', async () => {
      // Given a Google session whose sign-in is now 10 minutes ago
      const device = createDevice();
      await signInWithGoogle(device, { email: STUDENT_EMAIL });
      await setupCredentials(device, 'somchai_k').expect(200);
      e2e.clock.advance(TEN_MINUTES_MS);
      // When they try to reset
      await expectErrorCode(
        device.post('/auth/password/reset').send({ newPassword: NEW_PASSWORD }),
        403,
        'RECENT_GOOGLE_SIGN_IN_REQUIRED',
      );
      // Then the password is unchanged
      await createDevice()
        .post('/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
    });

    it('rejects a reset password outside the setup length rules', async () => {
      // Given a fresh Google session
      const device = createDevice();
      await signInWithGoogle(device, { email: STUDENT_EMAIL });
      await setupCredentials(device, 'somchai_k').expect(200);
      const inputTooLong = 'a'.repeat(73);
      // When the new password is shorter than 8 or longer than 72
      await device
        .post('/auth/password/reset')
        .send({ newPassword: 'short' })
        .expect(400);
      await device
        .post('/auth/password/reset')
        .send({ newPassword: inputTooLong })
        .expect(400);
      // Then the old password still signs in
      await createDevice()
        .post('/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
    });

    it('refuses a password reset before Credential setup', async () => {
      // Given a Google session that has not finished Credential setup
      const device = createDevice();
      await signInWithGoogle(device, { email: STUDENT_EMAIL });
      // When they try to reset
      await expectErrorCode(
        device.post('/auth/password/reset').send({ newPassword: NEW_PASSWORD }),
        403,
        'CREDENTIAL_SETUP_REQUIRED',
      );
    });

    it('reset from a session started with a password is 403', async () => {
      // Given a session started with a password
      await createUserWithCredentials(STUDENT_EMAIL, 'somchai_k');
      const device = await signInWithPassword();
      // When they try to reset without the old password
      await expectErrorCode(
        device.post('/auth/password/reset').send({ newPassword: NEW_PASSWORD }),
        403,
        'RECENT_GOOGLE_SIGN_IN_REQUIRED',
      );
      // Then the password is unchanged
      await createDevice()
        .post('/auth/login')
        .send({ username: 'somchai_k', password: PASSWORD })
        .expect(200);
    });
  });
});
