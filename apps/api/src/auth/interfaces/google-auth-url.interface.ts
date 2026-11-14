/** Response of `GET /auth/google`: where to send the browser to sign in. */
export interface GoogleAuthUrl {
  readonly url: string;
}
