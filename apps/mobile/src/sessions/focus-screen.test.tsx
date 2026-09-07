import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';

import { resetServerClock } from '../api/server-clock';
import type { Task } from '../tasks/task-types';
import type { Session } from './session-types';
import * as tasksApi from '../tasks/tasks-api';
import * as projectsApi from '../projects/projects-api';
import * as statsApi from '../stats/stats-api';
import * as sessionNotification from './session-notification';
import * as sessionsApi from './sessions-api';
import { FocusScreen } from './focus-screen';

jest.mock('./sessions-api');
jest.mock('./session-notification');
jest.mock('../tasks/tasks-api');
jest.mock('../projects/projects-api');
jest.mock('../stats/stats-api');
// The task a session is for arrives in the route, from a task's play button.
const mockRoute: { params: { taskId?: string } } = { params: {} };
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockRoute.params }));
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'ffffffff-0000-4000-8000-00000000000f' }));

const api = jest.mocked(sessionsApi);
const notifier = jest.mocked(sessionNotification);
const tasks = jest.mocked(tasksApi);
const projects = jest.mocked(projectsApi);
const stats = jest.mocked(statsApi);

const NOW = '2026-09-03T12:00:00.000Z';

function running(overrides: Partial<Session> = {}): Session {
  return {
    id: 'a5b6c7d8-0000-4000-8000-000000000001',
    taskId: null,
    kind: 'FOCUS',
    status: 'RUNNING',
    startedAt: NOW,
    durationSec: 1500,
    endedAt: null,
    elapsedSec: 0,
    remainingSec: 1500,
    dueAt: '2026-09-03T12:15:00.000Z',
    serverTime: NOW,
    ...overrides,
  };
}

const TASK_ID = 'b1000000-0000-4000-8000-000000000001';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: TASK_ID,
    title: 'Write the ADR',
    projectId: null,
    status: 'TODO',
    estimatedPomodoros: 4,
    completedPomodoros: 1,
    completedAt: null,
    createdAt: '2026-09-02T09:00:00.000Z',
    ...overrides,
  };
}

// `render` and `fireEvent` are asynchronous in Testing Library 14: both flush
// React's work before returning, so every interaction here is awaited.
function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <PaperProvider>
      <QueryClientProvider client={client}>
        <FocusScreen />
      </QueryClientProvider>
    </PaperProvider>,
  );
}

describe('focus screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = {};
    resetServerClock();
    jest.useFakeTimers().setSystemTime(new Date(NOW));
    notifier.scheduleSessionEnd.mockResolvedValue('notification-1');
    tasks.fetchTasks.mockResolvedValue([task()]);
    projects.fetchProjects.mockResolvedValue([]);
    stats.fetchDaily.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
    resetServerClock();
  });

  it('offers to start a session when nothing is running', async () => {
    api.fetchActiveSession.mockResolvedValue(null);

    await renderScreen();

    expect(await screen.findByText('START')).toBeOnTheScreen();
    // The ring shows what a session would be worth before one exists.
    expect(screen.getByText('of 25 min')).toBeOnTheScreen();
  });

  it('starts without a duration, leaving the length to the server preferences', async () => {
    api.fetchActiveSession.mockResolvedValue(null);
    api.startSession.mockResolvedValue(running());

    await renderScreen();

    await fireEvent.press(await screen.findByText('START'));

    // React Query hands the mutation function a context argument of its own, so
    // only the request body is worth asserting on.
    await waitFor(() => expect(api.startSession).toHaveBeenCalled());
    expect(api.startSession.mock.calls[0][0]).toEqual({
      kind: 'FOCUS',
      clientMutationId: 'ffffffff-0000-4000-8000-00000000000f',
    });
  });

  it('shows the time left on a session that was already running', async () => {
    api.fetchActiveSession.mockResolvedValue(running());

    await renderScreen();

    // Fifteen minutes to the deadline, whatever the payload's remaining count
    // claims and whatever this screen was doing before.
    expect(await screen.findByText('15:00')).toBeOnTheScreen();
    expect(screen.getByText('PAUSE')).toBeOnTheScreen();
  });

  it('counts down as time passes, without asking the server again', async () => {
    api.fetchActiveSession.mockResolvedValue(running());

    await renderScreen();
    await screen.findByText('15:00');

    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });

    expect(screen.getByText('10:00')).toBeOnTheScreen();
    expect(api.fetchActiveSession).toHaveBeenCalledTimes(1);
  });

  it('freezes the countdown while the session is paused', async () => {
    api.fetchActiveSession.mockResolvedValue(
      running({ status: 'PAUSED', dueAt: null, remainingSec: 600 }),
    );

    await renderScreen();

    expect(await screen.findByText('RESUME')).toBeOnTheScreen();

    jest.setSystemTime(new Date('2026-09-03T12:09:00.000Z'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('10:00')).toBeOnTheScreen();
  });

  it('adopts the session the server returns after a transition', async () => {
    api.fetchActiveSession.mockResolvedValue(running());
    api.transitionSession.mockResolvedValue(
      running({ status: 'PAUSED', dueAt: null, remainingSec: 900 }),
    );

    await renderScreen();

    await fireEvent.press(await screen.findByText('PAUSE'));

    expect(await screen.findByText('RESUME')).toBeOnTheScreen();
    expect(api.transitionSession).toHaveBeenCalledWith(
      'a5b6c7d8-0000-4000-8000-000000000001',
      'pause',
    );
  });
  it('books the end of a running session and takes it back when it is paused', async () => {
    api.fetchActiveSession.mockResolvedValue(running());
    api.transitionSession.mockResolvedValue(
      running({ status: 'PAUSED', dueAt: null, remainingSec: 900 }),
    );

    await renderScreen();

    await waitFor(() => expect(notifier.scheduleSessionEnd).toHaveBeenCalledTimes(1));

    await fireEvent.press(await screen.findByText('PAUSE'));

    // A paused session has no deadline, so the booking made for the old one
    // would go off during the pause.
    await waitFor(() => expect(notifier.cancelSessionEnd).toHaveBeenCalledWith('notification-1'));
  });

  it('does not rebook the same deadline when the session is fetched again', async () => {
    api.fetchActiveSession.mockResolvedValue(running());

    await renderScreen();

    await waitFor(() => expect(notifier.scheduleSessionEnd).toHaveBeenCalledTimes(1));

    // The screen refetches just past the deadline; the query hands back a new
    // object every time, which a naive effect would treat as a new session.
    await act(async () => {
      jest.advanceTimersByTime(16 * 60 * 1000);
    });

    expect(api.fetchActiveSession.mock.calls.length).toBeGreaterThan(1);
    expect(notifier.scheduleSessionEnd).toHaveBeenCalledTimes(1);
    expect(notifier.cancelSessionEnd).not.toHaveBeenCalled();
  });
  it('records the session against the task it was opened for', async () => {
    mockRoute.params = { taskId: TASK_ID };
    api.fetchActiveSession.mockResolvedValue(null);
    api.startSession.mockResolvedValue(running({ taskId: TASK_ID }));

    await renderScreen();

    expect(await screen.findByText('Write the ADR')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('START'));

    await waitFor(() => expect(api.startSession).toHaveBeenCalled());
    expect(api.startSession.mock.calls[0][0]).toEqual({
      kind: 'FOCUS',
      taskId: TASK_ID,
      clientMutationId: 'ffffffff-0000-4000-8000-00000000000f',
    });
  });

  it('starts on nothing in particular when the tab is opened on its own', async () => {
    api.fetchActiveSession.mockResolvedValue(null);
    api.startSession.mockResolvedValue(running());

    await renderScreen();

    await fireEvent.press(await screen.findByText('START'));

    await waitFor(() => expect(api.startSession).toHaveBeenCalled());
    expect(api.startSession.mock.calls[0][0]).toEqual({
      kind: 'FOCUS',
      clientMutationId: 'ffffffff-0000-4000-8000-00000000000f',
    });
  });

  it('lets the task it was opened for be dropped before starting', async () => {
    mockRoute.params = { taskId: TASK_ID };
    api.fetchActiveSession.mockResolvedValue(null);
    api.startSession.mockResolvedValue(running());

    await renderScreen();

    await fireEvent.press(await screen.findByLabelText('Focus without this task'));

    expect(screen.queryByText('Write the ADR')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByText('START'));

    await waitFor(() => expect(api.startSession).toHaveBeenCalled());
    expect(api.startSession.mock.calls[0][0]).toEqual({
      kind: 'FOCUS',
      clientMutationId: 'ffffffff-0000-4000-8000-00000000000f',
    });
  });

  it('names the task a running session belongs to', async () => {
    api.fetchActiveSession.mockResolvedValue(running({ taskId: TASK_ID }));

    await renderScreen();

    expect(await screen.findByText('Write the ADR')).toBeOnTheScreen();
  });

  it('names no task on a break, which is not work on anything', async () => {
    mockRoute.params = { taskId: TASK_ID };
    api.fetchActiveSession.mockResolvedValue(null);

    await renderScreen();

    await fireEvent.press(await screen.findByText('Short break'));

    expect(screen.queryByText('Write the ADR')).not.toBeOnTheScreen();
  });
});
