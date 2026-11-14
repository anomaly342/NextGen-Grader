import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { SessionUser } from './interfaces/session-user.interface';
import { SessionsService } from './sessions.service';

describe('SessionsService', () => {
  const inputUser: SessionUser = {
    id: 1,
    email: 'student@example.com',
    name: 'Student',
    avatarUrl: 'https://example.com/a.png',
    role: 'STUDENT',
  };
  let service: SessionsService;
  let mockStore: Map<string, string>;
  let mockRedis: { set: jest.Mock; get: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    mockStore = new Map();
    mockRedis = {
      set: jest.fn((key: string, value: string) => {
        mockStore.set(key, value);
        return Promise.resolve('OK');
      }),
      get: jest.fn((key: string) =>
        Promise.resolve(mockStore.get(key) ?? null),
      ),
      del: jest.fn((key: string) =>
        Promise.resolve(Number(mockStore.delete(key))),
      ),
    };
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
  });

  it('stores a JWT under a new cookie id with a TTL', async () => {
    const actualCookieId = await service.createSession(inputUser);
    expect(actualCookieId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(mockRedis.set).toHaveBeenCalledWith(
      actualCookieId,
      expect.stringMatching(/^ey/),
      'EX',
      expect.any(Number),
    );
  });

  it('returns the user body for a valid session', async () => {
    const inputCookieId = await service.createSession(inputUser);
    const actualUser = await service.getSession(inputCookieId);
    expect(actualUser).toEqual(inputUser);
  });

  it('returns null for an unknown cookie id', async () => {
    const actualUser = await service.getSession('missing');
    expect(actualUser).toBeNull();
  });

  it('returns null when the stored JWT was tampered with', async () => {
    const inputCookieId = await service.createSession(inputUser);
    mockStore.set(inputCookieId, `${mockStore.get(inputCookieId)}x`);
    const actualUser = await service.getSession(inputCookieId);
    expect(actualUser).toBeNull();
  });

  it('deletes the session on destroy', async () => {
    const inputCookieId = await service.createSession(inputUser);
    await service.destroySession(inputCookieId);
    const actualUser = await service.getSession(inputCookieId);
    expect(actualUser).toBeNull();
  });
});
