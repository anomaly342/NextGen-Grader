import { describe, expect, test } from 'bun:test';
import {
  getConfirmPasswordError,
  getPasswordError,
  getUsernameError,
} from './credential-rules.ts';

describe('getUsernameError', () => {
  test('accepts 4–20 lowercase letters, digits and underscores', () => {
    expect(getUsernameError('somchai_k')).toBeUndefined();
    expect(getUsernameError('ab_1')).toBeUndefined();
    expect(getUsernameError('a'.repeat(20))).toBeUndefined();
  });

  test('rejects fewer than 4 characters', () => {
    expect(getUsernameError('abc')).toBe('Use at least 4 characters.');
    expect(getUsernameError('')).toBe('Use at least 4 characters.');
  });

  test('rejects more than 20 characters', () => {
    expect(getUsernameError('a'.repeat(21))).toBe('Use at most 20 characters.');
  });

  test('rejects capitals, spaces and other symbols', () => {
    const message = 'Use only lowercase a–z, digits 0–9 and _.';
    expect(getUsernameError('Somchai')).toBe(message);
    expect(getUsernameError('som chai')).toBe(message);
    expect(getUsernameError('som-chai')).toBe(message);
    expect(getUsernameError('สมชาย_k')).toBe(message);
  });
});

describe('getPasswordError', () => {
  const tooShort = 'Use at least 8 characters.';
  const tooLong = 'Use at most 72 bytes (a Thai letter is 3).';

  test('accepts 8–72 characters of anything', () => {
    expect(getPasswordError('12345678')).toBeUndefined();
    expect(getPasswordError('correct horse battery staple')).toBeUndefined();
    expect(getPasswordError('x'.repeat(72))).toBeUndefined();
  });

  test('rejects fewer than 8 characters', () => {
    expect(getPasswordError('1234567')).toBe(tooShort);
  });

  test('rejects more than 72 characters', () => {
    expect(getPasswordError('x'.repeat(73))).toBe(tooLong);
  });

  test('counts the maximum in UTF-8 bytes, the part bcrypt keeps', () => {
    // A Thai letter is 3 bytes: 24 letters are 72 bytes, 25 are 75.
    expect(getPasswordError('ก'.repeat(24))).toBeUndefined();
    expect(getPasswordError('ก'.repeat(25))).toBe(tooLong);
    expect(getPasswordError(`${'x'.repeat(70)}ก`)).toBe(tooLong);
  });

  test('counts the minimum in characters, not bytes', () => {
    expect(getPasswordError('ก'.repeat(7))).toBe(tooShort);
    expect(getPasswordError('ก'.repeat(8))).toBeUndefined();
  });
});

describe('getConfirmPasswordError', () => {
  test('accepts a confirmation equal to the password', () => {
    expect(
      getConfirmPasswordError('labpass2027', 'labpass2027'),
    ).toBeUndefined();
  });

  test('rejects a different confirmation, case included', () => {
    const message = 'Does not match the password.';
    expect(getConfirmPasswordError('labpass2072', 'labpass2027')).toBe(message);
    expect(getConfirmPasswordError('Labpass2027', 'labpass2027')).toBe(message);
  });

  test('rejects an empty confirmation, even of an empty password', () => {
    const message = 'Type the password again.';
    expect(getConfirmPasswordError('', 'labpass2027')).toBe(message);
    expect(getConfirmPasswordError('', '')).toBe(message);
  });
});
