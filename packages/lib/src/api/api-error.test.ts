import { describe, expect, test } from 'bun:test';
import { ApiError } from './api-error.ts';

/** A failed response with `body` as its JSON. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ApiError.fromResponse', () => {
  describe('code', () => {
    test('keeps a known auth error code', async () => {
      const inputResponse = jsonResponse(401, { code: 'NOT_SIGNED_IN' });

      const actualError = await ApiError.fromResponse(inputResponse);

      expect(actualError.status).toBe(401);
      expect(actualError.code).toBe('NOT_SIGNED_IN');
    });

    test('gives null for a code that is not an auth error code', async () => {
      const inputResponse = jsonResponse(400, { code: 'SOMETHING_ELSE' });

      const actualError = await ApiError.fromResponse(inputResponse);

      expect(actualError.code).toBeNull();
    });

    test('gives null when the body has no code', async () => {
      const inputResponse = jsonResponse(400, { message: ['name is empty'] });

      const actualError = await ApiError.fromResponse(inputResponse);

      expect(actualError.code).toBeNull();
    });

    test('gives null code and retryAfterSec for a body that is not JSON', async () => {
      const inputResponse = new Response('<html>Bad Gateway</html>', {
        status: 502,
      });

      const actualError = await ApiError.fromResponse(inputResponse);

      expect(actualError.status).toBe(502);
      expect(actualError.code).toBeNull();
      expect(actualError.retryAfterSec).toBeNull();
    });
  });

  describe('retryAfterSec', () => {
    test('keeps a positive number', async () => {
      const inputResponse = jsonResponse(429, {
        code: 'TOO_MANY_ATTEMPTS',
        retryAfterSec: 42.5,
      });

      const actualError = await ApiError.fromResponse(inputResponse);

      expect(actualError.retryAfterSec).toBe(42.5);
    });

    test('gives null for zero', async () => {
      const inputResponse = jsonResponse(429, {
        code: 'TOO_MANY_ATTEMPTS',
        retryAfterSec: 0,
      });

      const actualError = await ApiError.fromResponse(inputResponse);

      expect(actualError.retryAfterSec).toBeNull();
    });

    test('gives null for a negative number', async () => {
      const inputResponse = jsonResponse(429, {
        code: 'TOO_MANY_ATTEMPTS',
        retryAfterSec: -5,
      });

      const actualError = await ApiError.fromResponse(inputResponse);

      expect(actualError.retryAfterSec).toBeNull();
    });

    test('gives null for a string', async () => {
      const inputResponse = jsonResponse(429, {
        code: 'TOO_MANY_ATTEMPTS',
        retryAfterSec: '30',
      });

      const actualError = await ApiError.fromResponse(inputResponse);

      expect(actualError.retryAfterSec).toBeNull();
    });

    test('gives null when missing', async () => {
      const inputResponse = jsonResponse(429, { code: 'TOO_MANY_ATTEMPTS' });

      const actualError = await ApiError.fromResponse(inputResponse);

      expect(actualError.retryAfterSec).toBeNull();
    });
  });
});
