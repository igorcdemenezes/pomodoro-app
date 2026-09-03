import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TaskStatus } from '@prisma/client';

import { TrimString } from '../../common/transformers';

export class CreateTaskDto {
  @ApiProperty({ example: 'Write architecture decision record', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @TrimString()
  title!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Omit to leave the task unfiled' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ example: 4, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  estimatedPomodoros?: number;
}
