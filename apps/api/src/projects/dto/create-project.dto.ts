import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsHexColor, IsString, MaxLength, MinLength, IsOptional } from 'class-validator';

import { TrimString } from '../../common/transformers';

export class CreateProjectDto {
  @ApiProperty({ example: 'Deep Work', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @TrimString()
  name!: string;

  @ApiPropertyOptional({ example: '#6E56CF', description: 'Hex colour, six digits' })
  @IsOptional()
  // Mirrors the project_color_is_hex CHECK, so a bad value fails as a readable
  // 400 before the database has to reject it.
  @IsHexColor()
  @MaxLength(7)
  color?: string;
}
