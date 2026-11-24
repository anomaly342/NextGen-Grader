import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { SessionRecord } from './interfaces/session-record.interface';
import { SessionUser } from './interfaces/session-user.interface';
import { SESSION_KEY_PREFIX, SESSION_TTL_SECONDS } from './sessions.constants';
import { SessionsService } from './sessions.service';

describe('SessionsService', () => {
  const inputUser: SessionUser = {
    id: 1,
    email: 'student@example.com',
    name: 'Student',
    avatarUrl: 'https://example.com/a.png',
    role: 'STUDENT',
  };
  const inputRecord: SessionRecord = {
    kind: 'USER',
    id: 1,
    user: inputUser,
    credentialsSetAt: null,
    startedBy: 'GOOGLE',
    lastLoginAt: new Date('2026-11-01T09:00:00.000Z'),
  };
  let service: SessionsService;
  let jwtService: JwtService;
  let mockStore: Map<string, string>;
  let mockRedis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    duplicate: jest.Mock;
  };

  beforeEach(async () => {
    mockStore = new Map();
    const client = {
      get: jest.fn((key: string) =>
        Promise.resolve(mockStore.get(key) ?? null),
      ),
      set: jest.fn((key: string, value: string, ...rest: unknown[]) => {
        const previous = mockStore.get(key) ?? null;
        mockStore.set(key, value);
        if (rest.includes('GET')) return Promise.resolve(previous);
        return Promise.resolve('OK');
      }),
      del: jest.fn((key: string) => {
        mockStore.delete(key);
        return Promise.resolve(1);
      }),
      watch: jest.fn(() => Promise.resolve('OK')),
      unwatch: jest.fn(() => Promise.resolve('OK')),
      multi: jest.fn(() => {
        const queued: Array<() => void> = [];
        const chain: {
          del: (key: string) => typeof chain;
          exec: () => Promise<unknown[]>;
        } = {
          del: (key: string) => {
            queued.push(() => mockStore.delete(key));
            return chain;
          },
          exec: () => {
            queued.forEach((run) => run());
            return Promise.resolve([]);
          },
        };
        return chain;
      }),
      disconnect: jest.fn(),
      duplicate: jest.fn(),
    };
    client.duplicate.mockReturnValue(client);
    mockRedis = client;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: Redis, useValue: mockRedis },
        {
          provide: JwtService,
          useValue: new JwtService({ secret: 'test-secret' }),
        },
      ],
    }).compile();
    service = module.get(SessionsService);
    jwtService = module.get(JwtService);
  });

  it('stores a User session under a new cookie id and points the account at it', async () => {
    const actualCookieId = await service.createSession(inputRecord);
    expect(actualCookieId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(mockRedis.set).toHaveBeenCalledWith(
      `${SESSION_KEY_PREFIX}${actualCookieId}`,
      expect.stringMatching(/^ey/),
      'EX',
      SESSION_TTL_SECONDS,
    );
    expect(mockRedis.set).toHaveBeenCalledWith(
      'ngg:session:pointer:USER:1',
      actualCookieId,
      'EX',
      SESSION_TTL_SECONDS,
      'GET',
    );
    const actualPayload = (await jwtService.verifyAsync(
      mockStore.get(`${SESSION_KEY_PREFIX}${actualCookieId}`)!,
    )) as unknown;
    expect(actualPayload).toMatchObject({
      kind: 'USER',
      id: 1,
      credentialsSetAt: null,
      startedBy: 'GOOGLE',
      lastLoginAt: '2026-11-01T09:00:00.000Z',
      email: inputUser.email,
      role: 'STUDENT',
    });
  });

  it('returns the current User session, including Credential setup', async () => {
    const inputCookieId = await service.createSession(inputRecord);
    const actualSession = await service.findCurrentUserSession(inputCookieId);
    expect(actualSession).toMatchObject({
      ...inputUser,
      kind: 'USER',
      credentialsSetAt: null,
      startedBy: 'GOOGLE',
      lastLoginAt: '2026-11-01T09:00:00.000Z',
    });
  });

  it('returns null for an unknown cookie id', async () => {
    const actualSession = await service.findCurrentUserSession('missing');
    expect(actualSession).toBeNull();
  });

  it('returns null when the stored JWT was tampered with', async () => {
    const inputCookieId = await service.createSession(inputRecord);
    const key = `${SESSION_KEY_PREFIX}${inputCookieId}`;
    mockStore.set(key, `${mockStore.get(key)}x`);
    const actualSession = await service.findCurrentUserSession(inputCookieId);
    expect(actualSession).toBeNull();
  });

  it('ends the previous session when the same User signs in again', async () => {
    const inputFirst = await service.createSession(inputRecord);
    const inputSecond = await service.createSession({
      ...inputRecord,
      startedBy: 'PASSWORD',
      lastLoginAt: null,
    });
    expect(await service.findCurrentUserSession(inputFirst)).toBeNull();
    expect(await service.findCurrentUserSession(inputSecond)).toMatchObject(
      inputUser,
    );
  });

  it('leaves another account session in place', async () => {
    const inputOther: SessionUser = {
      ...inputUser,
      id: 2,
      email: 'other@example.com',
    };
    const inputFirst = await service.createSession(inputRecord);
    const inputSecond = await service.createSession({
      ...inputRecord,
      id: 2,
      user: inputOther,
    });
    expect(await service.findCurrentUserSession(inputFirst)).toMatchObject(
      inputUser,
    );
    expect(await service.findCurrentUserSession(inputSecond)).toMatchObject(
      inputOther,
    );
  });

  it('returns null for a session whose kind is EXAMINEE', async () => {
    const inputCookieId = await service.createSession({
      ...inputRecord,
      kind: 'EXAMINEE',
    });
    expect(await service.findCurrentUserSession(inputCookieId)).toBeNull();
  });

  it('does not end a User session when an Examinee session is created for the same id', async () => {
    const inputUserCookie = await service.createSession(inputRecord);
    await service.createSession({ ...inputRecord, kind: 'EXAMINEE' });
    expect(await service.findCurrentUserSession(inputUserCookie)).toMatchObject(
      inputUser,
    );
  });

  it('deletes the session and its pointer on destroy', async () => {
    const inputCookieId = await service.createSession(inputRecord);
    await service.destroySession(inputCookieId);
    expect(await service.findCurrentUserSession(inputCookieId)).toBeNull();
    expect(mockStore.has('ngg:session:pointer:USER:1')).toBe(false);
  });

  it('destroying an old cookie does not delete the newer session', async () => {
    const inputFirst = await service.createSession(inputRecord);
    const inputSecond = await service.createSession(inputRecord);
    await service.destroySession(inputFirst);
    expect(await service.findCurrentUserSession(inputSecond)).toMatchObject(
      inputUser,
    );
  });
});
