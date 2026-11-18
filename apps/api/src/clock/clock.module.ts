import { Global, Module } from '@nestjs/common';
import { ClockService } from './clock.service';

/** Global so any service can inject ClockService without importing this module. */
@Global()
@Module({
  providers: [ClockService],
  exports: [ClockService],
})
export class ClockModule {}
