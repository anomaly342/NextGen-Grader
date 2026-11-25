/**
 * bcrypt hash of a random throwaway password. HashingService verifies against it
 * when there is no real hash, so a missing User or a User without a password takes
 * as long as a wrong password. Its cost (`$2b$12$`) must match BCRYPT_SALT_ROUNDS,
 * or the timing differs; hashing.service.spec.ts checks this.
 */
export const DUMMY_PASSWORD_HASH =
  '$2b$12$Y0Cyom8xEvoEqwpOrPqaAODanvtJD0tpqyy.WSqSrJcLXKo8aXFwi';
