import { describe, expect, test } from 'bun:test';
import { checkPassword, checkUsername } from './credential-rules.ts';

describe('checkUsername', () => {
  test('accepts 4–20 lowercase letters, digits and underscores', () => {
    expect(checkUsername('somchai_k')).toBeNull();
    expect(checkUsername('ab_1')).toBeNull();
    expect(checkUsername('a'.repeat(20))).toBeNull();
  });

  test('rejects fewer than 4 characters', () => {
    expect(checkUsername('abc')).toBe('TOO_SHORT');
    expect(checkUsername('')).toBe('TOO_SHORT');
  });

  test('rejects more than 20 characters', () => {
    expect(checkUsername('a'.repeat(21))).toBe('TOO_LONG');
  });

  test('rejects capitals, spaces and other symbols', () => {
    expect(checkUsername('Somchai')).toBe('INVALID_CHARACTERS');
    expect(checkUsername('som chai')).toBe('INVALID_CHARACTERS');
    expect(checkUsername('som-chai')).toBe('INVALID_CHARACTERS');
    expect(checkUsername('สมชาย_k')).toBe('INVALID_CHARACTERS');
  });
});

describe('checkPassword', () => {
  test('accepts 8–72 characters of anything', () => {
    expect(checkPassword('12345678')).toBeNull();
    expect(checkPassword('correct horse battery staple')).toBeNull();
    expect(checkPassword('x'.repeat(72))).toBeNull();
  });

  test('rejects fewer than 8 characters', () => {
    expect(checkPassword('1234567')).toBe('TOO_SHORT');
  });

  test('rejects more than 72 characters', () => {
    expect(checkPassword('x'.repeat(73))).toBe('TOO_LONG');
  });
});
