/**
 * Username and password rules for Credential setup, username change and
 * password change or reset. The API DTOs and the web forms both use these;
 * the API still has the final say through its 400 responses.
 */

/** Username: 4–20 characters, lowercase letters, digits and underscore. */
export const USERNAME_MIN_LENGTH = 4;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/;

/** Password minimum, in characters. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Password maximum, in UTF-8 bytes: bcrypt ignores everything past 72 bytes,
 * so longer is refused. A Thai letter is 3 bytes, so 24 of them hit it.
 */
export const PASSWORD_MAX_BYTES = 72;

/** Why a username breaks the rules. */
export type UsernameIssue = 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_CHARACTERS';

/** Why a password breaks the rules. */
export type PasswordIssue = 'TOO_SHORT' | 'TOO_LONG';

/** The first rule `username` breaks, or null when it follows them all. */
export function checkUsername(username: string): UsernameIssue | null {
  if (username.length < USERNAME_MIN_LENGTH) return 'TOO_SHORT';
  if (username.length > USERNAME_MAX_LENGTH) return 'TOO_LONG';
  if (!USERNAME_PATTERN.test(username)) return 'INVALID_CHARACTERS';
  return null;
}

/** The first rule `password` breaks, or null when it follows them all. */
export function checkPassword(password: string): PasswordIssue | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'TOO_SHORT';
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return 'TOO_LONG';
  }
  return null;
}

/**
 * Whether the confirmation is filled in and equal to `password`. Checked in
 * the browser only: the API never sees the confirmation.
 */
export function isPasswordConfirmed(
  confirmPassword: string,
  password: string,
): boolean {
  return confirmPassword !== '' && confirmPassword === password;
}
