import { describe, expect, test } from 'bun:test';
import { getErrorMessage } from './error-messages.ts';

describe('getErrorMessage', () => {
  test('gives one plain message for a wrong username or password', () => {
    expect(getErrorMessage('INVALID_CREDENTIALS')).toBe(
      'Wrong username or password.',
    );
  });

  test('tells a non-university Google account to use the university account', () => {
    expect(getErrorMessage('DOMAIN_NOT_ALLOWED')).toBe(
      'Sign in with your university account (@email.kmutnb.ac.th or @kmutnb.ac.th).',
    );
  });

  test('explains each Google sign-in failure sent back to /login', () => {
    expect(getErrorMessage('LOGIN_EXPIRED')).toBe(
      'Your sign-in expired or was cancelled. Try again.',
    );
    expect(getErrorMessage('EMAIL_NOT_VERIFIED')).toBe(
      'Google has not verified this email address.',
    );
  });

  test('maps the account and setup errors', () => {
    expect(getErrorMessage('USERNAME_TAKEN')).toBe(
      'That username is taken. Choose another.',
    );
    expect(getErrorMessage('SETUP_ALREADY_DONE')).toBe(
      'Your username and password are already set.',
    );
    expect(getErrorMessage('TOO_MANY_ATTEMPTS')).toBe(
      'Too many sign-in tries. Wait and try again.',
    );
    expect(getErrorMessage('RECENT_GOOGLE_SIGN_IN_REQUIRED')).toBe(
      'The 10 minutes to reset your password have passed. Sign in with your university account again.',
    );
    expect(getErrorMessage('NOT_SIGNED_IN')).toBe(
      'You are signed out. Sign in again.',
    );
    expect(getErrorMessage('CREDENTIAL_SETUP_REQUIRED')).toBe(
      'Choose a username and password first.',
    );
  });

  test('falls back to a general message for an unknown or missing code', () => {
    const fallback = 'Something went wrong. Try again.';
    expect(getErrorMessage('SOMETHING_NEW')).toBe(fallback);
    expect(getErrorMessage(null)).toBe(fallback);
    expect(getErrorMessage(undefined)).toBe(fallback);
  });

  test('does not treat Object.prototype keys as codes', () => {
    expect(getErrorMessage('toString')).toBe(
      'Something went wrong. Try again.',
    );
    expect(getErrorMessage('__proto__')).toBe(
      'Something went wrong. Try again.',
    );
  });
});
