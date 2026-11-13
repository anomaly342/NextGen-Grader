import { Injectable } from '@nestjs/common';
import { contract, db, type Db } from '@repo/prisma';

/** Every model in the `public` namespace, e.g. `Post`, `User`. */
type Models = Db['orm']['public'];

/**
 * Typed base so `PrismaService` exposes each model as a property
 * (`prismaService.User`, ...). The real getters are added in the constructor.
 */
const ModelsBase = class {} as new () => Models;

/**
 * Exposes the shared Prisma models from `@repo/prisma`, and nothing else.
 *
 * Query models directly: `this.prismaService.User.where({ id }).first()`.
 * The connection pool is closed by `PrismaModule` on shutdown.
 */
@Injectable()
export class PrismaService extends ModelsBase {
  constructor() {
    super();
    this.defineModelGetters();
  }

  /**
   * Adds a getter per model that forwards to `db.orm.public.<Model>`.
   * Model names come from the generated contract, so new models appear
   * automatically after `contract:emit`.
   */
  private defineModelGetters(): void {
    const names = Object.keys(
      contract.domain.namespaces.public.models,
    ) as (keyof Models)[];
    for (const name of names) {
      Object.defineProperty(this, name, {
        get: (): Models[typeof name] => db.orm.public[name],
        enumerable: true,
      });
    }
  }
}
