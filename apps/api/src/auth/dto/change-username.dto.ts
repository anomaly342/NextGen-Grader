import { PickType } from '@nestjs/swagger';
import { SetupCredentialsDto } from './setup-credentials.dto';

/** Body of PATCH /auth/username. Same username rules as Credential setup. */
export class ChangeUsernameDto extends PickType(SetupCredentialsDto, [
  'username',
] as const) {}
