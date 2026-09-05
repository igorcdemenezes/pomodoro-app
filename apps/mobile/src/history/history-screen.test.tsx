import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';

import type { Session } from '../sessions/session-types';
import type { Task } from '../tasks/task-types';
import * as tasksApi from '../tasks/tasks-api';
import * as historyApi from './history-api';
import { HistoryScreen } from './history-screen';

jest.mock('./history-api');
jest.mock('../tasks/tasks-api');

const api = jest.mocked(historyApi);
const tasks = jest.mocked(tasksApi);

const NOW = new Date(2026, 8, 4, 15, 0);
const TASK_ID = 't1000000-0000-4000-8000-000000000001';

/** Instants are built from local parts so assertions hold in any time zone. */
function session(startedAt: Date, overrides: Partial<Session> = {}): Session {
  return {
    id: startedAt.toISOString(),
    taskId: null,
    kind: 'FOCUS',
    status: 'COMPLETED',
    startedAt: startedAt.toISOString(),
    durationSec: 1500,
    endedAt: null,
    elapsedSec: 1500,
    remainingSec: 0,
    dueAt: null,
    serverTime: NOW.toISOString(),
    ...overrides,
  };
}

const TASK: Task = {
  id: TASK_ID,
  title: 'Write the ADR',
  projectId: null,
  status: 'IN_PROGRESS',
  estimatedPomodoros: 4,
  completedPomodoros: 1,
  completedAt: null,
  createdAt: '2026-09-02T09:00:00.000Z',
};

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <PaperProvider>
      <QueryClientProvider client={client}>
        <HistoryScreen />
      </QueryClientProvider>
    </PaperProvider>,
  );
}

describe('history screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    tasks.fetchTasks.mockResolvedValue([TASK]);
    api.fetchHistory.mockResolvedValue({
      items: [
        session(new Date(2026, 8, 4, 9, 0), { taskId: TASK_ID }),
        session(new Date(2026, 8, 3, 20, 30), {
          kind: 'SHORT_BREAK',
          durationSec: 300,
          elapsedSec: 300,
        }),
      ],
      nextCursor: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('files each session under the day it happened', async () => {
    await renderScreen();

    expect(await screen.findByText('Today')).toBeOnTheScreen();
    expect(screen.getByText('Yesterday')).toBeOnTheScreen();
    expect(screen.getByText('09:00')).toBeOnTheScreen();
  });

  it('names the task a session was run against', async () => {
    await renderScreen();

    expect(await screen.findByText('Write the ADR')).toBeOnTheScreen();
    // A session with no task falls back to what it was.
    expect(screen.getByText('Short break')).toBeOnTheScreen();
  });

  it('reports the time an abandoned session actually ran', async () => {
    api.fetchHistory.mockResolvedValue({
      items: [session(new Date(2026, 8, 4, 11, 0), { status: 'CANCELLED', elapsedSec: 420 })],
      nextCursor: null,
    });

    await renderScreen();

    // Seven minutes run, not the twenty-five that were booked.
    expect(await screen.findByText('Focus · 7m · Cancelled')).toBeOnTheScreen();
  });

  it('asks for the next page when the list runs out', async () => {
    api.fetchHistory.mockResolvedValueOnce({
      items: [session(new Date(2026, 8, 4, 9, 0))],
      nextCursor: 'c1000000-0000-4000-8000-000000000001',
    });

    await renderScreen();
    await screen.findByText('Today');

    await fireEvent(screen.getByTestId('history-list'), 'endReached');

    await waitFor(() =>
      expect(api.fetchHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: 'c1000000-0000-4000-8000-000000000001' }),
      ),
    );
  });

  it('drops the lower bound when the whole history is asked for', async () => {
    await renderScreen();

    await screen.findByText('Today');
    await fireEvent.press(screen.getByText('All'));

    await waitFor(() =>
      expect(api.fetchHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: undefined }),
      ),
    );
  });

  it('offers a wider period rather than an empty screen', async () => {
    api.fetchHistory.mockResolvedValue({ items: [], nextCursor: null });

    await renderScreen();

    expect(
      await screen.findByText('No session in this period. Try a wider one.'),
    ).toBeOnTheScreen();
  });
});
