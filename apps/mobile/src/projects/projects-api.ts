import { authenticatedRequest } from '../api/authenticated-request';
import type { CreateProjectInput, Project, UpdateProjectInput } from './project-types';

export function fetchProjects(includeArchived: boolean): Promise<Project[]> {
  return authenticatedRequest<Project[]>(`/projects?includeArchived=${includeArchived}`);
}

export function createProject(input: CreateProjectInput): Promise<Project> {
  return authenticatedRequest<Project>('/projects', { method: 'POST', body: input });
}

/**
 * Also how a project is archived and restored.
 *
 * The API exposes `DELETE /projects/:id` for archiving, but it only goes one
 * way; `archived` goes both, so the screen has a single call for the toggle.
 */
export function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  return authenticatedRequest<Project>(`/projects/${id}`, { method: 'PATCH', body: input });
}
