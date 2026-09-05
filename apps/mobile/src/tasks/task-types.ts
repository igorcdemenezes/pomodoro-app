/** The task contract, mirrored from the backend's `TaskDto`. */

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: string;
  title: string;
  /** Null while the task is unfiled. */
  projectId: string | null;
  status: TaskStatus;
  estimatedPomodoros: number;
  /** Focus sessions completed against this task. */
  completedPomodoros: number;
  completedAt: string | null;
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
  projectId?: string;
  estimatedPomodoros?: number;
}

export interface UpdateTaskInput {
  title?: string;
  /** Null unfiles the task. */
  projectId?: string | null;
  status?: TaskStatus;
  estimatedPomodoros?: number;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};
