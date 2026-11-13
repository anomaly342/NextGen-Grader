import { Module } from '@nestjs/common';
import { BcryptService } from './bcrypt.service';

/** Password hashing. Import this module where BcryptService is needed. */
@Module({
  providers: [BcryptService],
  exports: [BcryptService],
})
export class BcryptModule {}
