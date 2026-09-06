import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';

import * as authenticated from '../api/authenticated-request';
import { HttpError } from '../api/http-error';
import * as projectsApi from '../projects/projects-api';
import * as statsApi from '../stats/stats-api';
import * as tasksApi from '../tasks/tasks-api';
import type { Task } from '../tasks/task-types';
import { DashboardScreen } from './dashboard-screen';

jest.mock('../api/authenticated-request');
jest.mock('../projects/projects-api');
jest.mock('../stats/stats-api');
jest.mock('../tasks/tasks-api');

// Prefixed with `mock` so the factory below may close over it.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

// Prefixed with `mock` so the factory below may close over it.
const mockSignOut = jest.fn();
jest.mock('../auth/use-auth-actions', () => ({
  useAuthActions: () => ({ signOut: mockSignOut }),
}));

const request = jest.mocked(authenticated.authenticatedRequest);
const projects = jest.mocked(projectsApi);
const stats = jest.mocked(statsApi);
const tasks = jest.mocked(tasksApi);

const PROFILE = {
  id: 'u1000000-0000-4000-8000-000000000001',
  email: 'demo@pomodoro.app',
  name: 'Demo',
  focusDurationSec: 1500,
  shortBreakSec: 300,
  longBreakSec: 900,
  cyclesUntilLongBreak: 4,
  createdAt: '2026-09-01T09:00:00.000Z',
};

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1000000-0000-4000-8000-000000000001',
    title: 'Write the ADR',
    projectId: null,
    status: 'IN_PROGRESS',
    estimatedPomodoros: 4,
    completedPomodoros: 1,
    completedAt: null,
    createdAt: '2026-09-02T09:00:00.000Z',
    ...overrides,
  };
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <PaperProvider>
      <QueryClientProvider client={client}>
        <DashboardScreen />
      </QueryClientProvider>
    </PaperProvider>,
  );
}

describe('dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    request.mockResolvedValue(PROFILE);
    projects.fetchProjects.mockResolvedValue([]);
    tasks.fetchTasks.mockImplementation((filter) =>
      Promise.resolve(filter.status === 'IN_PROGRESS' ? [task()] : []),
    );
    stats.fetchDaily.mockResolvedValue([
      { day: '2026-09-02', focusedSeconds: 0, completedSessions: 0 },
      { day: '2026-09-03', focusedSeconds: 1500, completedSessions: 3 },
    ]);
    stats.fetchSummary.mockResolvedValue({
      focusedSeconds: 5100,
      focusedSecondsToday: 1500,
      completedSessions: 8,
      cancelledSessions: 2,
      completionRate: 0.8,
      currentStreakDays: 3,
      tasksCompleted: 4,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('leads with the focus already spent today', async () => {
    await renderScreen();

    expect(await screen.findByText('FOCUSED TODAY')).toBeOnTheScreen();
    expect(screen.getByText('25m')).toBeOnTheScreen();
    // The row under it counts today's sessions, not the week's, so the two
    // figures answer for the same window.
    expect(screen.getByLabelText('3 sessions completed today')).toBeOnTheScreen();
    expect(screen.getByLabelText('3 day streak')).toBeOnTheScreen();
  });

  it('lists what is in progress', async () => {
    await renderScreen();

    expect(await screen.findByText('Write the ADR')).toBeOnTheScreen();
    expect(screen.getByText('ACTIVE')).toBeOnTheScreen();
    expect(tasks.fetchTasks).toHaveBeenCalledWith({ status: 'IN_PROGRESS' });
  });

  it('opens the timer on the task the user pressed play on', async () => {
    await renderScreen();

    await fireEvent.press(await screen.findByLabelText('Focus on Write the ADR'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/focus',
      params: { taskId: task().id },
    });
  });

  it('keeps the rest of the screen when only the figures fail', async () => {
    stats.fetchSummary.mockRejectedValue(new HttpError(500, 'BOOM', 'Stats are down.'));

    await renderScreen();

    // The figures are one card, not the whole screen: what is in progress and
    // the way to start a session both still work.
    expect(await screen.findByText('Could not load your figures')).toBeOnTheScreen();
    expect(screen.getByText('Start focus')).toBeOnTheScreen();
    expect(screen.getByText('Write the ADR')).toBeOnTheScreen();
  });

  it('offers a way out when the profile itself cannot be loaded', async () => {
    // Sign out lives on the Profile screen, which this state cannot reach: a
    // user whose session is somehow broken would otherwise be stuck here.
    request.mockRejectedValue(new HttpError(500, 'BOOM', 'Profile is down.'));

    await renderScreen();

    await fireEvent.press(await screen.findByText('Sign out'));

    expect(mockSignOut).toHaveBeenCalled();
  });
});
