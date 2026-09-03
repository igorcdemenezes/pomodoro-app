import type { Project } from '@prisma/client';

import type { ProjectDto } from './dto/project.dto';

export interface ProjectCounts {
  taskCount: number;
  openTaskCount: number;
}

export function toProjectDto(project: Project, counts: ProjectCounts): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    color: project.color,
    archivedAt: project.archivedAt,
    createdAt: project.createdAt,
    ...counts,
  };
}
