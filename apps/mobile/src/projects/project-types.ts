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
