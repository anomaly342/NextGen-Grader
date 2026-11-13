import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SessionsService } from './sessions.service';

/**
 * Session storage in Redis with JWT-encoded user bodies.
 * Owns the JWT setup; other modules use sessions through SessionsService.
 */
@Module({
  imports: [JwtModule.register({ secret: process.env['JWT_SECRET'] })],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
