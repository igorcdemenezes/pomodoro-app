import { authenticatedRequest } from '../api/authenticated-request';
import type { CreateTaskInput, Task, TaskStatus, UpdateTaskInput } from './task-types';

export interface TaskFilter {
  projectId?: string;
  status?: TaskStatus;
}

export function fetchTasks(filter: TaskFilter): Promise<Task[]> {
  const query = Object.entries(filter)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
    .join('&');

  return authenticatedRequest<Task[]>(`/tasks${query ? `?${query}` : ''}`);
}

export function createTask(input: CreateTaskInput): Promise<Task> {
  return authenticatedRequest<Task>('/tasks', { method: 'POST', body: input });
}

export function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  return authenticatedRequest<Task>(`/tasks/${id}`, { method: 'PATCH', body: input });
}

export function deleteTask(id: string): Promise<void> {
  return authenticatedRequest<void>(`/tasks/${id}`, { method: 'DELETE' });
}
