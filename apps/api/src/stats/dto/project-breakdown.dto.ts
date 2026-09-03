import { ApiProperty } from '@nestjs/swagger';

export class ProjectBreakdownDto {
  @ApiProperty({ format: 'uuid', nullable: true, description: 'Null for sessions with no project' })
  projectId!: string | null;

  @ApiProperty({ example: 'Deep Work' })
  projectName!: string;

  @ApiProperty({ example: '#6E56CF' })
  color!: string;

  @ApiProperty({ example: 5400 })
  focusedSeconds!: number;

  @ApiProperty({ example: 4 })
  completedSessions!: number;
}
