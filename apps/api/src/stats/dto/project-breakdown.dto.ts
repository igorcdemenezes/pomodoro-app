import { ApiProperty } from '@nestjs/swagger';

export class ProjectBreakdownDto {
  @ApiProperty({ format: 'uuid' })
  projectId!: string;

  @ApiProperty({ example: 'Deep Work' })
  projectName!: string;

  @ApiProperty({ example: '#6E56CF' })
  color!: string;

  @ApiProperty({ example: 4, description: 'Tasks in the project, done or not' })
  taskCount!: number;

  @ApiProperty({ example: 2, description: 'Tasks in the project marked done' })
  completedTaskCount!: number;

  @ApiProperty({ example: 0.5, description: 'Done over total tasks' })
  completionRate!: number;
}
