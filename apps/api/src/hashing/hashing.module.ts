import { Module } from '@nestjs/common';
import { BcryptModule } from '@/bcrypt/bcrypt.module';
import { HashingService } from './hashing.service';

/**
 * Timing-safe password hashing. Import this module where passwords are hashed or
 * checked; it is the only module that imports BcryptModule.
 */
@Module({
  imports: [BcryptModule],
  providers: [HashingService],
  exports: [HashingService],
})
export class HashingModule {}
