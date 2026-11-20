import type { TokenPayload } from 'google-auth-library';

/** What a fake Google account says about itself; only `email` is required. */
export type FakeGoogleProfile = Partial<TokenPayload> & { email: string };
