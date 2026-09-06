import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';

import { HttpError } from '../api/http-error';
import * as statsApi from '../stats/stats-api';
import type { Project } from './project-types';
import * as projectsApi from './projects-api';
import { ProjectsScreen } from './projects-screen';

jest.mock('./projects-api');
jest.mock('../stats/stats-api');

// Prefixed with `mock` so the factory below may close over it.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const api = jest.mocked(projectsApi);
const stats = jest.mocked(statsApi);

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1000000-0000-4000-8000-000000000001',
    name: 'Deep Work',
    color: '#2A78D6',
    archivedAt: null,
    openTaskCount: 2,
    taskCount: 5,
    createdAt: '2026-09-01T09:00:00.000Z',
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
        <ProjectsScreen />
      </QueryClientProvider>
    </PaperProvider>,
  );
}

describe('projects screen', () => {
  // Paper animates its dialog and menus. Under real timers those keep running
  // after the assertions and hold the Jest process open, so time is faked here
  // as it is in the timer specs.
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    stats.fetchByProject.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists the projects with how much work each still holds', async () => {
    api.fetchProjects.mockResolvedValue([project()]);

    await renderScreen();

    expect(await screen.findByText('Deep Work')).toBeOnTheScreen();
    expect(screen.getByText('5 tasks · 3 done')).toBeOnTheScreen();
  });

  it('invites the first project when there are none', async () => {
    api.fetchProjects.mockResolvedValue([]);

    await renderScreen();

    expect(await screen.findByText('No projects yet')).toBeOnTheScreen();
  });

  it('creates a project with the name that was typed', async () => {
    api.fetchProjects.mockResolvedValue([]);
    api.createProject.mockResolvedValue(project({ name: 'Thesis' }));

    await renderScreen();

    await fireEvent.press(await screen.findByText('Create a project'));
    await fireEvent.changeText(screen.getByLabelText('Name'), '  Thesis  ');
    await fireEvent.press(screen.getByText('Save'));

    // The name is trimmed before it leaves: the backend trims too, but a value
    // that only differs by whitespace should not look like a new project here.
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith({ name: 'Thesis', color: '#1F9A62' }),
    );
  });

  it('archives a project without deleting its history', async () => {
    api.fetchProjects.mockResolvedValue([project()]);
    api.updateProject.mockResolvedValue(project({ archivedAt: '2026-09-04T10:00:00.000Z' }));

    await renderScreen();

    await fireEvent.press(await screen.findByLabelText('Actions for Deep Work'));
    await fireEvent.press(await screen.findByText('Archive'));

    await waitFor(() =>
      expect(api.updateProject).toHaveBeenCalledWith('p1000000-0000-4000-8000-000000000001', {
        archived: true,
      }),
    );
  });

  it('keeps the dialog open when the name is already taken', async () => {
    api.fetchProjects.mockResolvedValue([]);
    api.createProject.mockRejectedValue(
      new HttpError(409, 'PROJECT_NAME_TAKEN', 'Project name already used.'),
    );

    await renderScreen();

    await fireEvent.press(await screen.findByText('Create a project'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Deep Work');
    await fireEvent.press(screen.getByText('Save'));

    expect(await screen.findByText('You already have a project with that name.')).toBeOnTheScreen();
    // Still open, still holding the rejected name, so it can be corrected.
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Deep Work');
  });
});
