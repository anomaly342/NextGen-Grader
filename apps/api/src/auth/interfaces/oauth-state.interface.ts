/** What the `oauth_state` cookie carries between GET /auth/google and its callback. */
export interface OAuthState {
  /** CSRF check: the callback's `state` must equal this. */
  readonly state: string;
  /** Same-site path to return to after sign-in, or null for the start page. */
  readonly next: string | null;
}
