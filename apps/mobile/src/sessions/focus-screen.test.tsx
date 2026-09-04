import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';

import { resetServerClock } from '../api/server-clock';
import type { Session } from './session-types';
import * as sessionsApi from './sessions-api';
import { FocusScreen } from './focus-screen';

jest.mock('./sessions-api');
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'ffffffff-0000-4000-8000-00000000000f' }));

const api = jest.mocked(sessionsApi);

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
    resetServerClock();
    jest.useFakeTimers().setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    jest.useRealTimers();
    resetServerClock();
  });

  it('offers to start a session when nothing is running', async () => {
    api.fetchActiveSession.mockResolvedValue(null);

    await renderScreen();

    expect(await screen.findByText('Start focus')).toBeOnTheScreen();
  });

  it('starts without a duration, leaving the length to the server preferences', async () => {
    api.fetchActiveSession.mockResolvedValue(null);
    api.startSession.mockResolvedValue(running());

    await renderScreen();

    await fireEvent.press(await screen.findByText('Start focus'));

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
    expect(screen.getByText('Running')).toBeOnTheScreen();
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

    expect(await screen.findByText('Paused')).toBeOnTheScreen();

    jest.setSystemTime(new Date('2026-09-03T12:09:00.000Z'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('10:00')).toBeOnTheScreen();
    expect(screen.getByText('Resume')).toBeOnTheScreen();
  });

  it('adopts the session the server returns after a transition', async () => {
    api.fetchActiveSession.mockResolvedValue(running());
    api.transitionSession.mockResolvedValue(
      running({ status: 'PAUSED', dueAt: null, remainingSec: 900 }),
    );

    await renderScreen();

    await fireEvent.press(await screen.findByText('Pause'));

    expect(await screen.findByText('Resume')).toBeOnTheScreen();
    expect(api.transitionSession).toHaveBeenCalledWith(
      'a5b6c7d8-0000-4000-8000-000000000001',
      'pause',
    );
  });
});
