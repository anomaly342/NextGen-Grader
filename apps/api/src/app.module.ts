import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { SessionsModule } from './sessions/sessions.module';
import { ClockModule } from './clock/clock.module';

@Module({
  imports: [ClockModule, PrismaModule, RedisModule, SessionsModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
