import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/auth/auth.constants';

/** Body of POST /auth/password. The new password uses the same length rules as setup. */
export class ChangePasswordDto {
  @ApiProperty({ example: 'current password' })
  @IsString()
  @IsNotEmpty()
  readonly currentPassword!: string;

  @ApiProperty({
    example: 'correct horse battery staple',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  readonly newPassword!: string;
}
