import { SetMetadata } from '@nestjs/common';
import { SKIP_CREDENTIAL_SETUP_KEY } from './skip-credential-setup.constants';

/** Lets this route through while the session says Credential setup is not done. */
export const SkipCredentialSetup = (): MethodDecorator =>
  SetMetadata(SKIP_CREDENTIAL_SETUP_KEY, true);
