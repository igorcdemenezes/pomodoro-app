import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

import { NormaliseEmail, TrimString } from '../../common/transformers';

export class RegisterDto {
  @ApiProperty({ example: 'someone@example.com' })
  @IsEmail({}, { message: 'A valid email address is required.' })
  @MaxLength(255)
  @NormaliseEmail()
  email!: string;

  @ApiProperty({ example: 'Ada Lovelace', maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @TrimString()
  name!: string;

  @ApiProperty({ example: 'a-strong-password', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(128)
  password!: string;
}
