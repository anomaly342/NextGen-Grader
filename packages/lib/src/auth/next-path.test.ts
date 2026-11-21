import { describe, expect, test } from 'bun:test';
import { getSameSitePath } from './next-path.ts';

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
