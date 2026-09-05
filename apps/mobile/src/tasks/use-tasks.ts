import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { HttpError } from '../api/http-error';
import { projectsKey } from '../projects/use-projects';
import type { CreateTaskInput, Task, UpdateTaskInput } from './task-types';
import { createTask, deleteTask, fetchTasks, updateTask } from './tasks-api';
import type { TaskFilter } from './tasks-api';

export const tasksKey = ['tasks'] as const;

export function taskListKey(filter: TaskFilter) {
  return [...tasksKey, filter] as const;
}

export function useTasks(filter: TaskFilter) {
  return useQuery<Task[]>({
    queryKey: taskListKey(filter),
    queryFn: () => fetchTasks(filter),
  });
}

/**
 * Create, restatus and delete.
 *
 * Every one of these moves a project's open-task count, so the project list is
 * invalidated alongside the task list — otherwise going back would show counts
 * that disagree with the tasks just edited.
 */
export function useTaskMutations() {
  const client = useQueryClient();

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: tasksKey }),
      client.invalidateQueries({ queryKey: projectsKey }),
    ]);
  };

  const create = useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: refresh,
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: UpdateTaskInput & { id: string }) => updateTask(id, input),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: refresh,
  });

  return {
    create: create.mutateAsync,
    update: update.mutateAsync,
    remove: remove.mutateAsync,
    pending: create.isPending || update.isPending || remove.isPending,
    error: asHttpError(create.error ?? update.error ?? remove.error),
    clearError: () => {
      create.reset();
      update.reset();
      remove.reset();
    },
  };
}

function asHttpError(error: unknown): HttpError | null {
  if (!error) return null;

  return error instanceof HttpError ? error : HttpError.offline(error);
}
