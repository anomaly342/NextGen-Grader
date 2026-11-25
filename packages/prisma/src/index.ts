import type { FieldOutputTypes } from './prisma/contract.d.ts';

export { contract, db, type Db } from './prisma/db.ts';
export type { Contract } from './prisma/contract.d.ts';

/** Row type of a model in the `public` namespace, e.g. `ModelRow<'User'>`. */
export type ModelRow<Name extends keyof FieldOutputTypes['public']> =
  FieldOutputTypes['public'][Name];

/**
 * The User columns that may leave the API (its auth responses, the web app's
 * server pages). Picked, not omitted, so a new private column (a hash, an id
 * from another service) never reaches a client by accident.
 */
export type User = Pick<
  ModelRow<'User'>,
  | 'id'
  | 'email'
  | 'name'
  | 'username'
  | 'avatarUrl'
  | 'role'
  | 'credentialsSetAt'
>;
