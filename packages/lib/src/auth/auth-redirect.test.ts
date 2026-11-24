import { describe, expect, test } from 'bun:test';
import { getAuthRedirect } from './auth-redirect.ts';

describe('getAuthRedirect', () => {
  describe('signed out', () => {
    test('sends any Classroom page to /login with the page as next', () => {
      expect(
        getAuthRedirect({
          pathname: '/problems/1',
          search: '?tab=statement',
          user: null,
        }),
      ).toBe('/login?next=%2Fproblems%2F1%3Ftab%3Dstatement');
    });

    test('lets /login through', () => {
      expect(
        getAuthRedirect({
          pathname: '/login',
          search: '?next=%2Fproblems%2F1',
          user: null,
        }),
      ).toBeNull();
    });
  });

  describe('Credential setup not done', () => {
    const user = { role: 'STUDENT', credentialsSetAt: null } as const;

    test('sends any Classroom page to /setup with the page as next', () => {
      expect(
        getAuthRedirect({ pathname: '/problems/1', search: '', user }),
      ).toBe('/setup?next=%2Fproblems%2F1');
    });

    test('lets /setup through', () => {
      expect(
        getAuthRedirect({
          pathname: '/setup',
          search: '?next=%2Fproblems%2F1',
          user,
        }),
      ).toBeNull();
    });

    test('sends /login to /setup, keeping its next', () => {
      expect(
        getAuthRedirect({
          pathname: '/login',
          search: '?next=%2Fproblems%2F1',
          user,
        }),
      ).toBe('/setup?next=%2Fproblems%2F1');
    });

    test('drops an off-site next from /login', () => {
      expect(
        getAuthRedirect({
          pathname: '/login',
          search: '?next=%2F%2Fevil.com',
          user,
        }),
      ).toBe('/setup');
    });
  });

  describe('Credential setup done', () => {
    const student = {
      role: 'STUDENT',
      credentialsSetAt: new Date('2026-11-01T03:00:00Z'),
    } as const;
    const teacher = { ...student, role: 'TEACHER' } as const;

    test('sends /login and /setup to /', () => {
      expect(
        getAuthRedirect({
          pathname: '/login',
          search: '?next=%2Fproblems%2F1',
          user: student,
        }),
      ).toBe('/');
      expect(
        getAuthRedirect({ pathname: '/setup', search: '', user: student }),
      ).toBe('/');
    });

    test('sends / to /classrooms, for Students and Teachers alike', () => {
      expect(
        getAuthRedirect({ pathname: '/', search: '', user: student }),
      ).toBe('/classrooms');
      expect(
        getAuthRedirect({ pathname: '/', search: '', user: teacher }),
      ).toBe('/classrooms');
    });

    test('lets any Classroom page through', () => {
      expect(
        getAuthRedirect({
          pathname: '/problems/1',
          search: '?tab=statement',
          user: student,
        }),
      ).toBeNull();
    });
  });
});
