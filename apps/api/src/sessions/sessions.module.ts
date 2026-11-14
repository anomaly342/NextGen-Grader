import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SessionGuard } from '@/common/guards/session.guard';
import { SessionsService } from './sessions.service';

/**
 * Session storage in Redis with JWT-encoded user bodies.
 * Owns the JWT setup; other modules use sessions through SessionsService
 * and protect routes with `@UseGuards(SessionGuard)`.
 */
@Module({
  imports: [JwtModule.register({ secret: process.env['JWT_SECRET'] })],
  providers: [SessionsService, SessionGuard],
  exports: [SessionsService, SessionGuard],
})
export class SessionsModule {}
