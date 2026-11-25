import { describe, expect, test } from 'bun:test';
import { ApiError } from './api-error.ts';
import { redirectOnAuthError } from './auth-error-redirect.ts';

/** A fake `window.location` that records where it was sent. */
function fakeLocation(pathname: string, search = '') {
  const assigned: string[] = [];
  return {
    pathname,
    search,
    assigned,
    assign: (url: string) => {
      assigned.push(url);
    },
  };
}

/** A fake QueryClient that records whether it was cleared. */
function fakeCache() {
  const cache = { isCleared: false, clear: () => (cache.isCleared = true) };
  return cache;
}

describe('redirectOnAuthError', () => {
  test('401 NOT_SIGNED_IN goes to /login with the page as next and clears the cache', () => {
    const inputError = new ApiError(401, { code: 'NOT_SIGNED_IN' });
    const location = fakeLocation('/problems/1', '?tab=statement');
    const cache = fakeCache();

    const actualRedirected = redirectOnAuthError(inputError, cache, location);

    expect(actualRedirected).toBe(true);
    expect(location.assigned).toEqual([
      '/login?next=%2Fproblems%2F1%3Ftab%3Dstatement',
    ]);
    expect(cache.isCleared).toBe(true);
  });

  test('403 CREDENTIAL_SETUP_REQUIRED goes to /setup with the page as next', () => {
    const inputError = new ApiError(403, { code: 'CREDENTIAL_SETUP_REQUIRED' });
    const location = fakeLocation('/account');
    const cache = fakeCache();

    const actualRedirected = redirectOnAuthError(inputError, cache, location);

    expect(actualRedirected).toBe(true);
    expect(location.assigned).toEqual(['/setup?next=%2Faccount']);
    expect(cache.isCleared).toBe(false);
  });

  test('does not reload /login when already on it', () => {
    const inputError = new ApiError(401, { code: 'NOT_SIGNED_IN' });
    const location = fakeLocation('/login', '?next=%2Faccount');

    const actualRedirected = redirectOnAuthError(
      inputError,
      fakeCache(),
      location,
    );

    expect(actualRedirected).toBe(true);
    expect(location.assigned).toEqual([]);
  });

  test('does not reload /setup when already on it', () => {
    const inputError = new ApiError(403, { code: 'CREDENTIAL_SETUP_REQUIRED' });
    const location = fakeLocation('/setup');

    const actualRedirected = redirectOnAuthError(
      inputError,
      fakeCache(),
      location,
    );

    expect(actualRedirected).toBe(true);
    expect(location.assigned).toEqual([]);
  });

  test('leaves any other error to the caller', () => {
    const inputError = new ApiError(409, { code: 'USERNAME_TAKEN' });
    const location = fakeLocation('/account');
    const cache = fakeCache();

    const actualRedirected = redirectOnAuthError(inputError, cache, location);

    expect(actualRedirected).toBe(false);
    expect(location.assigned).toEqual([]);
    expect(cache.isCleared).toBe(false);
  });
});
