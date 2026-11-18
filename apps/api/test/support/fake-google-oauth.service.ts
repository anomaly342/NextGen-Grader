import type {
  GenerateAuthUrlOpts,
  TokenPayload,
  VerifyIdTokenOptions,
} from 'google-auth-library';
import type { FakeGoogleProfile } from './interfaces/fake-google-profile.interface';

/**
 * Stands in for google-auth-library's OAuth2Client. A test registers a `code`
 * with the profile Google would vouch for; any other code is rejected like an
 * expired or forged one.
 */
export class FakeGoogleOAuthService {
  private readonly profiles = new Map<string, TokenPayload>();

  /** Makes `code` sign in as `profile` (verified email unless stated otherwise). */
  registerCode(code: string, profile: FakeGoogleProfile): void {
    this.profiles.set(code, {
      iss: 'https://accounts.google.com',
      aud: process.env['GOOGLE_CLIENT_ID']!,
      iat: 0,
      exp: 0,
      sub: `google-${profile.email}`,
      email_verified: true,
      name: 'Test User',
      picture: 'https://example.com/avatar.png',
      ...profile,
    });
  }

  /** Forgets every registered code. */
  reset(): void {
    this.profiles.clear();
  }

  /** The consent-screen URL; carries `state` like Google's does. */
  generateAuthUrl({ state }: GenerateAuthUrlOpts): string {
    return `https://accounts.google.test/o/oauth2/auth?state=${encodeURIComponent(state ?? '')}`;
  }

  /** Trades a registered code for an ID token (the code itself, as a handle). */
  getToken(code: string): Promise<{ tokens: { id_token: string } }> {
    if (!this.profiles.has(code)) {
      return Promise.reject(new Error('invalid_grant'));
    }
    return Promise.resolve({ tokens: { id_token: code } });
  }

  /** Returns the profile registered for the ID token's code. */
  verifyIdToken({
    idToken,
  }: VerifyIdTokenOptions): Promise<{ getPayload: () => TokenPayload }> {
    const payload = this.profiles.get(idToken);
    if (!payload) return Promise.reject(new Error('Invalid token'));
    return Promise.resolve({ getPayload: () => payload });
  }
}
