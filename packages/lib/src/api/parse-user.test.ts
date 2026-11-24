import { describe, expect, test } from 'bun:test';
import { parseUser } from './parse-user.ts';

describe('parseUser', () => {
  test('turns an ISO credentialsSetAt into a date and keeps the other fields', () => {
    const inputBody = {
      id: 7,
      email: 's6601012345678@email.kmutnb.ac.th',
      name: 'Somchai K.',
      username: 'somchai_k',
      avatarUrl: 'https://example.com/a.png',
      role: 'STUDENT',
      credentialsSetAt: '2026-11-24T03:15:00.000Z',
    } as const;

    const actualUser = parseUser(inputBody);

    expect(actualUser).toEqual({
      id: 7,
      email: 's6601012345678@email.kmutnb.ac.th',
      name: 'Somchai K.',
      username: 'somchai_k',
      avatarUrl: 'https://example.com/a.png',
      role: 'STUDENT',
      credentialsSetAt: new Date(Date.UTC(2026, 10, 24, 3, 15)),
    });
    expect(actualUser.credentialsSetAt).toBeInstanceOf(Date);
  });

  test('keeps a null credentialsSetAt as null', () => {
    const inputBody = {
      id: 8,
      email: 'pim@kmutnb.ac.th',
      name: 'Pim',
      username: null,
      avatarUrl: '',
      role: 'TEACHER',
      credentialsSetAt: null,
    } as const;

    const actualUser = parseUser(inputBody);

    expect(actualUser.credentialsSetAt).toBeNull();
  });
});
