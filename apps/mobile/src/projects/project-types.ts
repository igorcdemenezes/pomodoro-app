/** The project contract, mirrored from the backend's `ProjectDto`. */

export interface Project {
  id: string;
  name: string;
  color: string;
  /** Null while the project is active. Archived projects keep their history. */
  archivedAt: string | null;
  /** Tasks that are not done. */
  openTaskCount: number;
  taskCount: number;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
  color?: string;
}

export interface UpdateProjectInput {
  name?: string;
  color?: string;
  archived?: boolean;
}

/**
 * The palette offered when creating a project.
 *
 * A fixed set rather than a colour picker: the colour exists to tell projects
 * apart at a glance, and a free picker invites two projects that are almost the
 * same shade. Every value is six-digit hex, which is what the API validates.
 */
export const PROJECT_COLORS = [
  '#6E56CF',
  '#E5484D',
  '#30A46C',
  '#0091FF',
  '#F76808',
  '#E93D82',
  '#8E4EC6',
  '#12A594',
] as const;
