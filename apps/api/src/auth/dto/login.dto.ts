import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Body of POST /auth/login. Rules aren't re-checked here: any wrong value is just 401. */
export class LoginDto {
  @ApiProperty({ example: 'somchai_k' })
  @IsString()
  @IsNotEmpty()
  readonly username!: string;

  @ApiProperty({ example: 'correct horse battery staple' })
  @IsString()
  @IsNotEmpty()
  readonly password!: string;
}
