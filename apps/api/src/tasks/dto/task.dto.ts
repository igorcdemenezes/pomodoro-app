import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';

export class TaskDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Write architecture decision record' })
  title!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  projectId!: string | null;

  @ApiProperty({ enum: TaskStatus })
  status!: TaskStatus;

  @ApiProperty({ example: 4 })
  estimatedPomodoros!: number;

  @ApiProperty({ example: 2, description: 'Focus sessions completed against this task' })
  completedPomodoros!: number;

  @ApiPropertyOptional({ nullable: true })
  completedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}
