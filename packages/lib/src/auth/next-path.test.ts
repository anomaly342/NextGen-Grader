import { describe, expect, test } from 'bun:test';
import {
  getSameSitePath,
  LOGIN_PATH,
  NEXT_PATH_MAX_LENGTH,
  SETUP_PATH,
  withNext,
} from './next-path.ts';

describe('getSameSitePath', () => {
  test('keeps a same-site relative path, with its query', () => {
    expect(getSameSitePath('/problems/1')).toBe('/problems/1');
    expect(getSameSitePath('/')).toBe('/');
    expect(getSameSitePath('/classrooms?tab=practice#top')).toBe(
      '/classrooms?tab=practice#top',
    );
  });

  test('drops protocol-relative and absolute URLs', () => {
    expect(getSameSitePath('//evil.com')).toBeNull();
    expect(getSameSitePath('https://evil.com')).toBeNull();
    expect(getSameSitePath('javascript:alert(1)')).toBeNull();
  });

  test('drops paths that do not start with /', () => {
    expect(getSameSitePath('problems/1')).toBeNull();
    expect(getSameSitePath('')).toBeNull();
  });

  test('drops backslashes and control characters browsers would turn into //', () => {
    expect(getSameSitePath('/\\evil.com')).toBeNull();
    expect(getSameSitePath('/a\\b')).toBeNull();
    expect(getSameSitePath('/\t/evil.com')).toBeNull();
    expect(getSameSitePath('/\n/evil.com')).toBeNull();
  });

  test('drops paths longer than 2048 characters', () => {
    expect(getSameSitePath('/' + 'a'.repeat(2047))).toBe(
      '/' + 'a'.repeat(2047),
    );
    expect(getSameSitePath('/' + 'a'.repeat(2048))).toBeNull();
  });

  test('drops anything that is not a string', () => {
    expect(getSameSitePath(undefined)).toBeNull();
    expect(getSameSitePath(null)).toBeNull();
    expect(getSameSitePath(['/a', '/b'])).toBeNull();
  });
});

describe('withNext', () => {
  test('adds a same-site next, encoded', () => {
    expect(withNext(LOGIN_PATH, '/problems/1?tab=statement')).toBe(
      '/login?next=%2Fproblems%2F1%3Ftab%3Dstatement',
    );
  });

  test('gives just the page for an off-site next', () => {
    expect(withNext(SETUP_PATH, '//evil.com')).toBe('/setup');
  });

  test('gives just the page for an over-long next', () => {
    expect(withNext(LOGIN_PATH, '/' + 'a'.repeat(NEXT_PATH_MAX_LENGTH))).toBe(
      '/login',
    );
  });

  test('gives just the page for a null next', () => {
    expect(withNext(LOGIN_PATH, null)).toBe('/login');
  });
});
