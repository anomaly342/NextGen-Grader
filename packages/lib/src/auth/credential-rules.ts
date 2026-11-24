/**
 * Credential rules: username and password rules for Credential setup,
 * username change and password change or reset. The web forms show the
 * messages and rule texts from here; the API DTOs use the constants with
 * their own decorators and have the final say through their 400 responses.
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

/** The username rules, shown under every username input. */
export const USERNAME_RULE_TEXT = `${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters: lowercase a–z, digits 0–9 and _.`;

/** The password rules, shown under every new-password input. */
export const PASSWORD_RULE_TEXT = `At least ${PASSWORD_MIN_LENGTH} characters, at most ${PASSWORD_MAX_BYTES} bytes (a Thai letter is 3).`;

/** The message for the first rule `username` breaks, or nothing when it follows them all. */
export function getUsernameError(username: string): string | undefined {
  if (username.length < USERNAME_MIN_LENGTH) {
    return `Use at least ${USERNAME_MIN_LENGTH} characters.`;
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return `Use at most ${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!USERNAME_PATTERN.test(username)) {
    return 'Use only lowercase a–z, digits 0–9 and _.';
  }
  return undefined;
}

/** The message for the first rule `password` breaks, or nothing when it follows them all. */
export function getPasswordError(password: string): string | undefined {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return `Use at most ${PASSWORD_MAX_BYTES} bytes (a Thai letter is 3).`;
  }
  return undefined;
}

/**
 * The message when the confirmation is empty or not equal to `password`, or
 * nothing when it matches. Checked in the browser only: the API never sees
 * the confirmation.
 */
export function getConfirmPasswordError(
  confirmPassword: string,
  password: string,
): string | undefined {
  if (confirmPassword === '') return 'Type the password again.';
  if (confirmPassword !== password) return 'Does not match the password.';
  return undefined;
}
