import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsHexColor, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { TrimString } from '../../common/transformers';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Deep Work' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @TrimString()
  name?: string;

  @ApiPropertyOptional({ example: '#30A46C' })
  @IsOptional()
  @IsHexColor()
  @MaxLength(7)
  color?: string;

  @ApiPropertyOptional({
    description: 'Archive or restore. Archiving keeps the project and its recorded focus time.',
  })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
