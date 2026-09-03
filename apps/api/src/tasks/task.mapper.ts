import type { Task } from '@prisma/client';

import type { TaskDto } from './dto/task.dto';

export function toTaskDto(task: Task, completedPomodoros: number): TaskDto {
  return {
    id: task.id,
    title: task.title,
    projectId: task.projectId,
    status: task.status,
    estimatedPomodoros: task.estimatedPomodoros,
    completedPomodoros,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
  };
}
