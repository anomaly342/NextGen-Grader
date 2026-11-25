import { ApiProperty } from '@nestjs/swagger';
import { IsByteLength, IsString, MinLength } from 'class-validator';
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
} from '@repo/lib/auth/credential-rules';

/** Body of POST /auth/password/reset. Same password rules as Credential setup. */
export class ResetPasswordDto {
  @ApiProperty({
    example: 'correct horse battery staple',
    minLength: PASSWORD_MIN_LENGTH,
    description: `At most ${PASSWORD_MAX_BYTES} bytes in UTF-8 (what bcrypt keeps).`,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @IsByteLength(0, PASSWORD_MAX_BYTES)
  readonly newPassword!: string;
}
