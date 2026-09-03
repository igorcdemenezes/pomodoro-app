import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Write architecture decision record' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @TrimString()
  title?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Null unfiles the task' })
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @ApiPropertyOptional({ enum: TaskStatus })
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
