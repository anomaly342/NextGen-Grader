import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { db } from '@repo/prisma';
import { PrismaService } from './prisma.service';

/**
 * Global so any module can inject PrismaService without importing this module.
 * Owns the client's lifecycle, so PrismaService doesn't have to expose it.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule implements OnModuleDestroy {
  /** Closes the shared connection pool when Nest shuts down. */
  async onModuleDestroy(): Promise<void> {
    await db.close();
  }
}
