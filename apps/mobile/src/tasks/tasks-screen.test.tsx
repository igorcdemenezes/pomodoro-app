import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';

import { HttpError } from '../api/http-error';
import type { Project } from '../projects/project-types';
import * as projectsApi from '../projects/projects-api';
import type { Task } from './task-types';
import * as tasksApi from './tasks-api';
import { TasksScreen } from './tasks-screen';

jest.mock('./tasks-api');
jest.mock('../projects/projects-api');

// Prefixed with `mock` so the factory below may close over it.
const mockParams: { projectId?: string } = {};
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));

const api = jest.mocked(tasksApi);
const projects = jest.mocked(projectsApi);

const PROJECT_ID = 'p1000000-0000-4000-8000-000000000001';
const TASK_ID = 't1000000-0000-4000-8000-000000000001';

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: PROJECT_ID,
    name: 'Deep Work',
    color: '#2A78D6',
    archivedAt: null,
    openTaskCount: 1,
    taskCount: 1,
    createdAt: '2026-09-01T09:00:00.000Z',
    ...overrides,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: TASK_ID,
    title: 'Write the ADR',
    projectId: PROJECT_ID,
    status: 'TODO',
    estimatedPomodoros: 4,
    completedPomodoros: 1,
    completedAt: null,
    createdAt: '2026-09-02T09:00:00.000Z',
    ...overrides,
  };
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <PaperProvider>
      <QueryClientProvider client={client}>
        <TasksScreen />
      </QueryClientProvider>
    </PaperProvider>,
  );
}

describe('tasks screen', () => {
  // Paper animates its menus and dialog; real timers would outlive the spec.
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    delete mockParams.projectId;
    projects.fetchProjects.mockResolvedValue([project()]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows a task with its project and the focus already spent on it', async () => {
    api.fetchTasks.mockResolvedValue([task()]);

    await renderScreen();

    expect(await screen.findByText('Write the ADR')).toBeOnTheScreen();
    expect(await screen.findByText('Deep Work · 1/4 pomodoros')).toBeOnTheScreen();
  });

  it('files a new task under the project the list is filtered to', async () => {
    mockParams.projectId = PROJECT_ID;
    api.fetchTasks.mockResolvedValue([]);
    api.createTask.mockResolvedValue(task({ title: 'Draft the README' }));

    await renderScreen();

    await fireEvent.changeText(await screen.findByLabelText('Add a task'), 'Draft the README');
    await fireEvent.press(screen.getByLabelText('Add task'));

    await waitFor(() =>
      expect(api.createTask).toHaveBeenCalledWith({
        title: 'Draft the README',
        projectId: PROJECT_ID,
      }),
    );
  });

  it('opens filtered when arriving from a project', async () => {
    mockParams.projectId = PROJECT_ID;
    api.fetchTasks.mockResolvedValue([task()]);

    await renderScreen();

    await waitFor(() =>
      expect(api.fetchTasks).toHaveBeenCalledWith({ projectId: PROJECT_ID, status: undefined }),
    );
  });

  it('asks the server for the status the user selected', async () => {
    api.fetchTasks.mockResolvedValue([task()]);

    await renderScreen();

    await fireEvent.press(await screen.findByText('Done'));

    await waitFor(() =>
      expect(api.fetchTasks).toHaveBeenCalledWith({ projectId: undefined, status: 'DONE' }),
    );
  });

  it('completes a task from its checkbox', async () => {
    api.fetchTasks.mockResolvedValue([task()]);
    api.updateTask.mockResolvedValue(task({ status: 'DONE' }));

    await renderScreen();

    await fireEvent.press(await screen.findByLabelText('Mark Write the ADR as done'));

    await waitFor(() => expect(api.updateTask).toHaveBeenCalledWith(TASK_ID, { status: 'DONE' }));
  });

  it('explains why a task running a session cannot be deleted', async () => {
    api.fetchTasks.mockResolvedValue([task()]);
    api.deleteTask.mockRejectedValue(
      new HttpError(400, 'TASK_HAS_ACTIVE_SESSION', 'Finish the session first.'),
    );

    await renderScreen();

    await fireEvent.press(await screen.findByLabelText('Actions for Write the ADR'));
    await fireEvent.press(await screen.findByText('Delete'));
    await fireEvent.press(await screen.findByText('Delete task'));

    expect(
      await screen.findByText('A session is running on this task. Finish or cancel it first.'),
    ).toBeOnTheScreen();
  });
});
