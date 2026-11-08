import { Injectable } from '@nestjs/common';

/** Root application service used by the health/hello endpoint. */
@Injectable()
export class AppService {
  /** Returns a simple greeting so the API can be smoke-tested. */
  getHello(): string {
    return 'Hello World!';
  }
}
