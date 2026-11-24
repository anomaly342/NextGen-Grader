import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CredentialSetupGuard } from '@/common/guards/credential-setup.guard';
import { SessionMiddleware } from '@/common/middleware/session.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { SessionsModule } from './sessions/sessions.module';
import { ClockModule } from './clock/clock.module';

/** Root NestJS module; registers app-wide session middleware and guards. */
@Module({
  imports: [ClockModule, PrismaModule, RedisModule, SessionsModule, AuthModule],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: CredentialSetupGuard },
  ],
})
export class AppModule implements NestModule {
  /** Loads the current User session onto `req.session` once per HTTP request. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionMiddleware).forRoutes('{*path}');
  }
}
