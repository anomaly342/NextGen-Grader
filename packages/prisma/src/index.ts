import type { FieldOutputTypes } from './prisma/contract.d.ts';

export { contract, db, type Db } from './prisma/db.ts';
export type { Contract } from './prisma/contract.d.ts';

/** Row type of a model in the `public` namespace, e.g. `ModelRow<'User'>`. */
export type ModelRow<Name extends keyof FieldOutputTypes['public']> =
  FieldOutputTypes['public'][Name];
