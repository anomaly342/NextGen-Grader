import { ApiProperty } from '@nestjs/swagger';
import {
  IsByteLength,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '@repo/lib/auth/credential-rules';
/** Body of POST /auth/setup. */
export class SetupCredentialsDto {
  @ApiProperty({
    example: 'somchai_k',
    minLength: USERNAME_MIN_LENGTH,
    maxLength: USERNAME_MAX_LENGTH,
    pattern: USERNAME_PATTERN.source,
  })
  @IsString()
  @Length(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH)
  @Matches(USERNAME_PATTERN, {
    message: 'username may only contain a-z, 0-9 and _',
  })
  readonly username!: string;

  @ApiProperty({
    example: 'correct horse battery staple',
    minLength: PASSWORD_MIN_LENGTH,
    description: `At most ${PASSWORD_MAX_BYTES} bytes in UTF-8 (what bcrypt keeps).`,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @IsByteLength(0, PASSWORD_MAX_BYTES)
  readonly password!: string;
}
