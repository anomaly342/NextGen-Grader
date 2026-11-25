import { Module } from '@nestjs/common';
import { BcryptService } from './bcrypt.service';

/** Raw bcrypt. Only HashingModule imports this; everything else uses HashingService. */
@Module({
  providers: [BcryptService],
  exports: [BcryptService],
})
export class BcryptModule {}
