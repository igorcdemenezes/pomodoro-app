import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProjectDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Deep Work' })
  name!: string;

  @ApiProperty({ example: '#6E56CF' })
  color!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Null while the project is active' })
  archivedAt!: Date | null;

  @ApiProperty({ example: 4, description: 'Tasks that are not done' })
  openTaskCount!: number;

  @ApiProperty({ example: 12, description: 'Tasks in total' })
  taskCount!: number;

  @ApiProperty()
  createdAt!: Date;
}
