import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { HttpError } from '../api/http-error';
import type { CreateProjectInput, Project, UpdateProjectInput } from './project-types';
import { createProject, fetchProjects, updateProject } from './projects-api';

export const projectsKey = ['projects'] as const;

export function projectListKey(includeArchived: boolean) {
  return [...projectsKey, { includeArchived }] as const;
}

export function useProjects(includeArchived: boolean) {
  return useQuery<Project[]>({
    queryKey: projectListKey(includeArchived),
    queryFn: () => fetchProjects(includeArchived),
  });
}

/**
 * Create, rename, recolour, archive and restore.
 *
 * Nothing is written into the cache by hand: the counts on a project are
 * computed by the backend, so a locally patched project would show stale
 * numbers. Invalidating asks for the list the server actually has.
 */
export function useProjectMutations() {
  const client = useQueryClient();

  const refresh = () => client.invalidateQueries({ queryKey: projectsKey });

  const create = useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: refresh,
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: UpdateProjectInput & { id: string }) => updateProject(id, input),
    onSuccess: refresh,
  });

  return {
    create: create.mutateAsync,
    update: update.mutateAsync,
    pending: create.isPending || update.isPending,
    error: asHttpError(create.error ?? update.error),
    clearError: () => {
      create.reset();
      update.reset();
    },
  };
}

function asHttpError(error: unknown): HttpError | null {
  if (!error) return null;

  return error instanceof HttpError ? error : HttpError.offline(error);
}
