import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

import { NormaliseEmail } from '../../common/transformers';

export class LoginDto {
  @ApiProperty({ example: 'demo@pomodoro.app' })
  @IsEmail()
  @NormaliseEmail()
  email!: string;

  @ApiProperty({ example: 'demo1234' })
  @IsString()
  @MaxLength(128)
  password!: string;

  @ApiProperty({ required: false, example: 'Pixel 8', description: 'Shown when listing sessions' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceLabel?: string;
}
