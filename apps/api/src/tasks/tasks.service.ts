import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SessionKind, SessionStatus, TaskStatus } from '@prisma/client';
import type { Prisma, Task } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { TaskDto } from './dto/task.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';
import { toTaskDto } from './task.mapper';

export interface FindTasksFilter {
  projectId?: string;
  status?: TaskStatus;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, filter: FindTasksFilter): Promise<TaskDto[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        ...(filter.projectId ? { projectId: filter.projectId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return this.withCompletedCounts(userId, tasks);
  }

  async findOne(userId: string, id: string): Promise<TaskDto> {
    const task = await this.requireOwned(userId, id);
    const [dto] = await this.withCompletedCounts(userId, [task]);

    return dto;
  }

  async create(userId: string, dto: CreateTaskDto): Promise<TaskDto> {
    if (dto.projectId) await this.requireOwnedProject(userId, dto.projectId);

    const status = dto.status ?? TaskStatus.TODO;

    const task = await this.prisma.task.create({
      data: {
        userId,
        title: dto.title,
        projectId: dto.projectId ?? null,
        status,
        estimatedPomodoros: dto.estimatedPomodoros ?? 1,
        // The task_completed_at_matches_status CHECK requires these to agree.
        completedAt: status === TaskStatus.DONE ? new Date() : null,
      },
    });

    return toTaskDto(task, 0);
  }

  async update(userId: string, id: string, dto: UpdateTaskDto): Promise<TaskDto> {
    const existing = await this.requireOwned(userId, id);

    if (dto.projectId) await this.requireOwnedProject(userId, dto.projectId);

    const data: Prisma.TaskUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.estimatedPomodoros !== undefined) data.estimatedPomodoros = dto.estimatedPomodoros;
    if (dto.projectId !== undefined) data.projectId = dto.projectId;

    if (dto.status !== undefined && dto.status !== existing.status) {
      data.status = dto.status;
      // completedAt is derived from the status rather than accepted from the
      // client, so the two can never disagree.
      data.completedAt = dto.status === TaskStatus.DONE ? new Date() : null;
    }

    const task = await this.prisma.task.update({ where: { id }, data });
    const [result] = await this.withCompletedCounts(userId, [task]);

    return result;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireOwned(userId, id);

    const activeSession = await this.prisma.pomodoroSession.findFirst({
      where: { userId, taskId: id, status: { in: [SessionStatus.RUNNING, SessionStatus.PAUSED] } },
    });

    if (activeSession) {
      throw new BadRequestException({
        code: 'TASK_HAS_ACTIVE_SESSION',
        message: 'Finish or cancel the session running on this task first.',
      });
    }

    // Sessions keep their history; the foreign key detaches them (ON DELETE SET NULL).
    await this.prisma.task.delete({ where: { id } });
  }

  /** Completed focus sessions per task, in one grouped query rather than N. */
  private async withCompletedCounts(userId: string, tasks: Task[]): Promise<TaskDto[]> {
    if (tasks.length === 0) return [];

    const counts = await this.prisma.pomodoroSession.groupBy({
      by: ['taskId'],
      where: {
        userId,
        taskId: { in: tasks.map((task) => task.id) },
        kind: SessionKind.FOCUS,
        status: SessionStatus.COMPLETED,
      },
      _count: { _all: true },
    });

    const byTask = new Map(counts.map((row) => [row.taskId, row._count._all]));

    return tasks.map((task) => toTaskDto(task, byTask.get(task.id) ?? 0));
  }

  private async requireOwned(userId: string, id: string): Promise<Task> {
    const task = await this.prisma.task.findFirst({ where: { id, userId } });

    if (!task) {
      throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Task not found.' });
    }

    return task;
  }

  /**
   * A task may only be filed under a project of the same owner. Without this the
   * foreign key would still accept it, since projects are not scoped by the
   * request's user at the database level.
   */
  private async requireOwnedProject(userId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });

    if (!project) {
      throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: 'Project not found.' });
    }
  }
}
