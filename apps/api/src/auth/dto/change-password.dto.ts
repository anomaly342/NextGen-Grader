import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ResetPasswordDto } from './reset-password.dto';

/** Body of POST /auth/password. The new password uses the same length rules as setup. */
export class ChangePasswordDto extends PickType(ResetPasswordDto, [
  'newPassword',
] as const) {
  @ApiProperty({ example: 'current password' })
  @IsString()
  @IsNotEmpty()
  readonly currentPassword!: string;
}
