import { PickType } from '@nestjs/swagger';
import { SetupCredentialsDto } from './setup-credentials.dto';

/** Query of GET /auth/check-username. Same username rules as Credential setup. */
export class CheckUsernameDto extends PickType(SetupCredentialsDto, [
  'username',
] as const) {}
