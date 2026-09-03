import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import type { Prisma, Project } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { ProjectDto } from './dto/project.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';
import { toProjectDto } from './project.mapper';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, includeArchived: boolean): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ archivedAt: 'asc' }, { createdAt: 'asc' }],
    });

    if (projects.length === 0) return [];

    // One grouped query instead of a count per project: the list screen would
    // otherwise issue N+1 round trips as the user adds projects.
    const counts = await this.prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: { userId, projectId: { in: projects.map((project) => project.id) } },
      _count: { _all: true },
    });

    const byProject = new Map<string, { taskCount: number; openTaskCount: number }>();
    for (const row of counts) {
      if (!row.projectId) continue;
      const entry = byProject.get(row.projectId) ?? { taskCount: 0, openTaskCount: 0 };
      entry.taskCount += row._count._all;
      if (row.status !== TaskStatus.DONE) entry.openTaskCount += row._count._all;
      byProject.set(row.projectId, entry);
    }

    return projects.map((project) =>
      toProjectDto(project, byProject.get(project.id) ?? { taskCount: 0, openTaskCount: 0 }),
    );
  }

  async findOne(userId: string, id: string): Promise<ProjectDto> {
    const project = await this.requireOwned(userId, id);

    const [taskCount, openTaskCount] = await Promise.all([
      this.prisma.task.count({ where: { userId, projectId: id } }),
      this.prisma.task.count({
        where: { userId, projectId: id, status: { not: TaskStatus.DONE } },
      }),
    ]);

    return toProjectDto(project, { taskCount, openTaskCount });
  }

  async create(userId: string, dto: CreateProjectDto): Promise<ProjectDto> {
    // The partial unique index rejects a duplicate active name; the filter turns
    // that into 409 PROJECT_NAME_TAKEN.
    const project = await this.prisma.project.create({
      data: { userId, name: dto.name, ...(dto.color ? { color: dto.color } : {}) },
    });

    return toProjectDto(project, { taskCount: 0, openTaskCount: 0 });
  }

  async update(userId: string, id: string, dto: UpdateProjectDto): Promise<ProjectDto> {
    await this.requireOwned(userId, id);

    const data: Prisma.ProjectUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.archived !== undefined) data.archivedAt = dto.archived ? new Date() : null;

    await this.prisma.project.update({ where: { id }, data });

    return this.findOne(userId, id);
  }

  /**
   * Archives instead of deleting: sessions recorded against this project's tasks
   * are history, and history must not disappear because a project was tidied up.
   */
  async archive(userId: string, id: string): Promise<ProjectDto> {
    const project = await this.requireOwned(userId, id);

    if (!project.archivedAt) {
      await this.prisma.project.update({ where: { id }, data: { archivedAt: new Date() } });
    }

    return this.findOne(userId, id);
  }

  /**
   * Answers 404, never 403, for a project owned by someone else: a 403 would
   * confirm the id exists.
   */
  private async requireOwned(userId: string, id: string): Promise<Project> {
    const project = await this.prisma.project.findFirst({ where: { id, userId } });

    if (!project) {
      throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: 'Project not found.' });
    }

    return project;
  }
}
