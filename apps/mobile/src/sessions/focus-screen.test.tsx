import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';

import { HttpError } from '../api/http-error';
import { resetServerClock } from '../api/server-clock';
import type { Task } from '../tasks/task-types';
import type { Session } from './session-types';
import * as tasksApi from '../tasks/tasks-api';
import * as projectsApi from '../projects/projects-api';
import * as sessionNotification from './session-notification';
import * as sessionsApi from './sessions-api';
import { FocusScreen } from './focus-screen';

jest.mock('./sessions-api');
jest.mock('./session-notification');
jest.mock('../tasks/tasks-api');
jest.mock('../projects/projects-api');
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
async function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  // Built fresh each time: React skips a subtree handed the very same element
  // object again, so re-rendering with a reused one would change nothing.
  const tree = () => (
    <PaperProvider>
      <QueryClientProvider client={client}>
        <FocusScreen />
      </QueryClientProvider>
    </PaperProvider>
  );
  const view = await render(tree());

  // The route is read on every render, so a test that moves the params — a
  // task's play button pressed while this tab is already mounted — re-renders
  // the tree to deliver them, the way navigation would.
  return { ...view, client, rerender: () => view.rerender(tree()) };
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
    api.fetchCycle.mockResolvedValue({ completedInCycle: 0, cyclesUntilLongBreak: 4 });
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

  // After a Pomodoro the screen rests on the short break it earned. A task's
  // play button pressed from there asks for a Pomodoro on that task, not for
  // the break: a break carries no task, so the history would show it on nothing.
  it('starts a focus on the task it was opened for, even after a Pomodoro', async () => {
    api.fetchActiveSession.mockResolvedValueOnce(running()).mockResolvedValue(null);
    api.transitionSession.mockResolvedValue(
      running({ status: 'COMPLETED', dueAt: null, remainingSec: 0, endedAt: NOW }),
    );
    api.startSession.mockResolvedValue(running({ taskId: TASK_ID }));

    const view = await renderScreen();

    await fireEvent.press(await screen.findByText('COMPLETE'));

    expect(await screen.findByLabelText('Up next: Short break')).toBeOnTheScreen();

    mockRoute.params = { taskId: TASK_ID };
    await view.rerender();

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
    api.fetchActiveSession
      .mockResolvedValueOnce(running({ taskId: TASK_ID }))
      .mockResolvedValue(null);
    api.transitionSession.mockResolvedValue(
      running({ taskId: TASK_ID, status: 'COMPLETED', dueAt: null, remainingSec: 0, endedAt: NOW }),
    );

    await renderScreen();

    expect(await screen.findByText('Write the ADR')).toBeOnTheScreen();

    await fireEvent.press(await screen.findByText('COMPLETE'));

    expect(await screen.findByText('START')).toBeOnTheScreen();
    expect(screen.queryByText('Write the ADR')).not.toBeOnTheScreen();
  });

  // The phase follows the method and the run the server counts, so the three
  // are reported rather than offered: a tappable long break could be started on
  // a run nobody has earned, which the marks above cannot even draw.
  it('does not let the phase be picked by hand', async () => {
    api.fetchActiveSession.mockResolvedValue(null);

    await renderScreen();

    expect(await screen.findByText('Short break')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Short break' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Long break' })).not.toBeOnTheScreen();
  });
  describe('the run up to a long break', () => {
    it('marks the Pomodoros the server has recorded in the current run', async () => {
      api.fetchActiveSession.mockResolvedValue(null);
      api.fetchCycle.mockResolvedValue({ completedInCycle: 2, cyclesUntilLongBreak: 4 });

      await renderScreen();

      expect(await screen.findByText('2 / 4')).toBeOnTheScreen();
    });

    it('draws the run at the length the user configured', async () => {
      api.fetchActiveSession.mockResolvedValue(null);
      api.fetchCycle.mockResolvedValue({ completedInCycle: 1, cyclesUntilLongBreak: 6 });

      await renderScreen();

      expect(await screen.findByText('1 / 6')).toBeOnTheScreen();
    });

    it('says a long break is next once the run is complete', async () => {
      api.fetchActiveSession.mockResolvedValue(null);
      api.fetchCycle.mockResolvedValue({ completedInCycle: 4, cyclesUntilLongBreak: 4 });

      await renderScreen();

      expect(await screen.findByText('Long break next')).toBeOnTheScreen();
    });

    // Skipping long breaks pushes the count past the end of the run; the row
    // has nowhere to say five, and saying "a long break is next" is the point.
    it('does not count past the end of the run', async () => {
      api.fetchActiveSession.mockResolvedValue(null);
      api.fetchCycle.mockResolvedValue({ completedInCycle: 7, cyclesUntilLongBreak: 4 });

      await renderScreen();

      expect(await screen.findByText('Long break next')).toBeOnTheScreen();
    });

    // The long break happens once per run, so while it is what the screen is
    // about the row measures it — not the four Pomodoros that paid for it.
    it('measures the long break itself while it runs', async () => {
      api.fetchActiveSession.mockResolvedValue(running({ kind: 'LONG_BREAK', durationSec: 900 }));
      api.fetchCycle.mockResolvedValue({ completedInCycle: 4, cyclesUntilLongBreak: 4 });

      await renderScreen();

      expect(await screen.findByText('0 / 1')).toBeOnTheScreen();
      expect(screen.queryByText('4 / 4')).not.toBeOnTheScreen();
      expect(screen.queryByText('Long break next')).not.toBeOnTheScreen();
    });

    it('reads the long break as done once its time is up', async () => {
      api.fetchActiveSession.mockResolvedValue(
        running({ kind: 'LONG_BREAK', durationSec: 900, dueAt: NOW, remainingSec: 0 }),
      );
      api.fetchCycle.mockResolvedValue({ completedInCycle: 4, cyclesUntilLongBreak: 4 });

      await renderScreen();

      expect(await screen.findByText('1 / 1')).toBeOnTheScreen();
    });

    // The long break is what clears the run, so once it is over the row stops
    // measuring the rest and goes back to counting the Pomodoros of the next
    // one.
    it('goes back to the run once the long break is over', async () => {
      api.fetchActiveSession
        .mockResolvedValueOnce(running({ kind: 'LONG_BREAK', durationSec: 900 }))
        .mockResolvedValue(null);
      api.transitionSession.mockResolvedValue(
        running({
          kind: 'LONG_BREAK',
          status: 'COMPLETED',
          dueAt: null,
          remainingSec: 0,
          endedAt: NOW,
        }),
      );
      api.fetchCycle
        .mockResolvedValueOnce({ completedInCycle: 4, cyclesUntilLongBreak: 4 })
        .mockResolvedValue({ completedInCycle: 0, cyclesUntilLongBreak: 4 });

      await renderScreen();

      expect(await screen.findByText('0 / 1')).toBeOnTheScreen();

      await fireEvent.press(await screen.findByText('COMPLETE'));

      expect(await screen.findByText('0 / 4')).toBeOnTheScreen();
    });

    // An empty row would read as a cycle at zero — a claim about the user's day,
    // when the truth is that the answer never arrived.
    it('draws no row at all while the run is unknown', async () => {
      api.fetchActiveSession.mockResolvedValue(null);
      api.fetchCycle.mockRejectedValue(new Error('offline'));

      await renderScreen();

      expect(await screen.findByText('START')).toBeOnTheScreen();
      expect(screen.queryByText('0 / 4')).not.toBeOnTheScreen();
    });

    it('asks where the run stands again once a session has ended', async () => {
      api.fetchActiveSession.mockResolvedValueOnce(running()).mockResolvedValue(null);
      api.transitionSession.mockResolvedValue(
        running({ status: 'COMPLETED', dueAt: null, remainingSec: 0, endedAt: NOW }),
      );
      api.fetchCycle
        .mockResolvedValueOnce({ completedInCycle: 2, cyclesUntilLongBreak: 4 })
        .mockResolvedValue({ completedInCycle: 3, cyclesUntilLongBreak: 4 });

      await renderScreen();

      await fireEvent.press(await screen.findByText('COMPLETE'));

      expect(await screen.findByText('3 / 4')).toBeOnTheScreen();
    });

    // The tabs stay mounted, so a figure counted from finished sessions has
    // no other reason to be fetched again: the dashboard kept yesterday's
    // numbers until the app was reopened.
    it('marks the figures counted from sessions stale once one has ended', async () => {
      api.fetchActiveSession.mockResolvedValueOnce(running()).mockResolvedValue(null);
      api.transitionSession.mockResolvedValue(
        running({ status: 'COMPLETED', dueAt: null, remainingSec: 0, endedAt: NOW }),
      );

      const { client } = await renderScreen();
      const summaryKey = ['stats', 'summary', 'week'];
      const historyKey = ['sessions', 'history', 'week'];
      client.setQueryData(summaryKey, { completedSessions: 2 });
      client.setQueryData(historyKey, { pages: [], pageParams: [] });

      await fireEvent.press(await screen.findByText('COMPLETE'));

      await waitFor(() => expect(client.getQueryState(summaryKey)?.isInvalidated).toBe(true));
      expect(client.getQueryState(historyKey)?.isInvalidated).toBe(true);
      // The task's Pomodoro count moved too; the list is fetched again.
      await waitFor(() => expect(tasks.fetchTasks).toHaveBeenCalledTimes(2));
    });
  });
  // The run is counted from what is recorded, so a user who lost track of it
  // — back after a long gap, two Pomodoros in — used to have no way out but a
  // long break they had not earned. The way out is a boundary, not an erasure.
  describe('starting the run over', () => {
    it('offers to start the run over once there is something to let go of', async () => {
      api.fetchActiveSession.mockResolvedValue(null);
      api.fetchCycle.mockResolvedValue({ completedInCycle: 2, cyclesUntilLongBreak: 4 });

      await renderScreen();

      expect(await screen.findByLabelText('Start the run over')).toBeOnTheScreen();
    });

    it('offers nothing to reset at the beginning of a run', async () => {
      api.fetchActiveSession.mockResolvedValue(null);

      await renderScreen();

      expect(await screen.findByText('0 / 4')).toBeOnTheScreen();
      expect(screen.queryByLabelText('Start the run over')).not.toBeOnTheScreen();
    });

    it('does not offer it while a session runs', async () => {
      api.fetchActiveSession.mockResolvedValue(running());
      api.fetchCycle.mockResolvedValue({ completedInCycle: 2, cyclesUntilLongBreak: 4 });

      await renderScreen();

      expect(await screen.findByText('2 / 4')).toBeOnTheScreen();
      expect(screen.queryByLabelText('Start the run over')).not.toBeOnTheScreen();
    });

    it('asks first, saying what stays', async () => {
      api.fetchActiveSession.mockResolvedValue(null);
      api.fetchCycle.mockResolvedValue({ completedInCycle: 2, cyclesUntilLongBreak: 4 });

      await renderScreen();

      await fireEvent.press(await screen.findByLabelText('Start the run over'));

      expect(await screen.findByText('Start the run over?')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'The 2 Pomodoros done so far stay in your statistics. Only the count toward the long break goes back to 0.',
        ),
      ).toBeOnTheScreen();
      expect(api.resetCycle).not.toHaveBeenCalled();
    });

    it('leaves the run alone when the question is turned down', async () => {
      api.fetchActiveSession.mockResolvedValue(null);
      api.fetchCycle.mockResolvedValue({ completedInCycle: 2, cyclesUntilLongBreak: 4 });

      await renderScreen();

      await fireEvent.press(await screen.findByLabelText('Start the run over'));
      await fireEvent.press(await screen.findByText('Keep the run'));

      expect(api.resetCycle).not.toHaveBeenCalled();
      expect(screen.getByText('2 / 4')).toBeOnTheScreen();
    });

    // The long break that was owed goes with the run: a new run begins with
    // work, whatever the old one was about to offer.
    it('puts the run back at the beginning and offers focus', async () => {
      api.fetchActiveSession
        .mockResolvedValueOnce(running({ kind: 'SHORT_BREAK', durationSec: 300 }))
        .mockResolvedValue(null);
      api.transitionSession.mockResolvedValue(
        running({ kind: 'SHORT_BREAK', status: 'COMPLETED', dueAt: null, remainingSec: 0 }),
      );
      api.fetchCycle.mockResolvedValue({ completedInCycle: 4, cyclesUntilLongBreak: 4 });
      api.resetCycle.mockResolvedValue({ completedInCycle: 0, cyclesUntilLongBreak: 4 });

      await renderScreen();
      await fireEvent.press(await screen.findByText('COMPLETE'));

      expect(await screen.findByLabelText('Up next: Long break')).toBeOnTheScreen();

      await fireEvent.press(await screen.findByLabelText('Start the run over'));
      await fireEvent.press(await screen.findByLabelText('Reset run'));

      await waitFor(() => expect(api.resetCycle).toHaveBeenCalledTimes(1));
      expect(await screen.findByText('0 / 4')).toBeOnTheScreen();
      expect(screen.getByLabelText('Up next: Focus')).toBeOnTheScreen();
      expect(screen.getByText('Run reset — the next Pomodoro starts a new run.')).toBeOnTheScreen();
    });

    it('reports a reset that did not reach the server', async () => {
      api.fetchActiveSession.mockResolvedValue(null);
      api.fetchCycle.mockResolvedValue({ completedInCycle: 2, cyclesUntilLongBreak: 4 });
      api.resetCycle.mockRejectedValue(HttpError.offline());

      await renderScreen();

      await fireEvent.press(await screen.findByLabelText('Start the run over'));
      await fireEvent.press(await screen.findByLabelText('Reset run'));

      expect(await screen.findByText('Could not reach the server.')).toBeOnTheScreen();
      expect(screen.getByText('2 / 4')).toBeOnTheScreen();
    });
  });

  // The count does not move when a session is cancelled, which on screen reads
  // as a button that did nothing. The question is where that gets explained —
  // and it is a question at all because a thumb lands beside PAUSE.
  describe('cancelling a session', () => {
    it('asks first, naming the minutes at stake and what survives', async () => {
      api.fetchActiveSession.mockResolvedValue(
        running({ remainingSec: 900, dueAt: '2026-09-03T12:15:00.000Z' }),
      );
      api.fetchCycle.mockResolvedValue({ completedInCycle: 3, cyclesUntilLongBreak: 4 });

      await renderScreen();

      await fireEvent.press(await screen.findByText('CANCEL'));

      expect(await screen.findByText('Cancel this Pomodoro?')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'The 10 min so far are not recorded, and the run stays at 3 of 4 — a Pomodoro counts only once it finishes.',
        ),
      ).toBeOnTheScreen();
      expect(api.transitionSession).not.toHaveBeenCalled();
    });

    it('leaves the session running when the question is turned down', async () => {
      api.fetchActiveSession.mockResolvedValue(running());

      await renderScreen();

      await fireEvent.press(await screen.findByText('CANCEL'));
      await fireEvent.press(await screen.findByText('Keep going'));

      expect(api.transitionSession).not.toHaveBeenCalled();
      expect(screen.getByText('PAUSE')).toBeOnTheScreen();
    });

    // A break is not what the run counts, so cancelling one is the cheapest
    // thing on this screen — and saying so is what stops the user guessing.
    it('says a cancelled break costs the run nothing', async () => {
      api.fetchActiveSession.mockResolvedValue(running({ kind: 'SHORT_BREAK', durationSec: 300 }));
      api.fetchCycle.mockResolvedValue({ completedInCycle: 2, cyclesUntilLongBreak: 4 });

      await renderScreen();

      await fireEvent.press(await screen.findByText('CANCEL'));

      expect(await screen.findByText('Cancel this break?')).toBeOnTheScreen();
      expect(screen.getByText(/the run stays at 2 of 4 either way/)).toBeOnTheScreen();
    });

    // The long break is the one session whose ending clears the run, so giving
    // up on one leaves a debt the other two never do.
    it('says a cancelled long break leaves the run uncleared', async () => {
      api.fetchActiveSession.mockResolvedValue(running({ kind: 'LONG_BREAK', durationSec: 900 }));
      api.fetchCycle.mockResolvedValue({ completedInCycle: 4, cyclesUntilLongBreak: 4 });

      await renderScreen();

      await fireEvent.press(await screen.findByText('CANCEL'));

      expect(await screen.findByText('Cancel this long break?')).toBeOnTheScreen();
      expect(screen.getByText(/the next one is still owed/)).toBeOnTheScreen();
    });

    // The banked Pomodoros survive the one that was interrupted, and the
    // confirmation afterwards says so rather than naming the button pressed.
    it('keeps the run where it was and reports why', async () => {
      api.fetchActiveSession.mockResolvedValueOnce(running()).mockResolvedValue(null);
      api.transitionSession.mockResolvedValue(
        running({ status: 'CANCELLED', dueAt: null, remainingSec: 0, endedAt: NOW }),
      );
      api.fetchCycle.mockResolvedValue({ completedInCycle: 3, cyclesUntilLongBreak: 4 });

      await renderScreen();

      await fireEvent.press(await screen.findByText('CANCEL'));
      await fireEvent.press(await screen.findByText('Cancel session'));

      // Awaited on the notice, not on the row: the row already said 3 / 4
      // before the tap, so waiting on it would prove nothing about the cancel
      // having landed.
      expect(
        await screen.findByText('Session cancelled — this Pomodoro did not count toward the run.'),
      ).toBeOnTheScreen();
      expect(screen.getByText('3 / 4')).toBeOnTheScreen();
    });
  });

  describe('what the screen moves to next', () => {
    // The screen never starts the next session on its own: a break that began
    // in a pocket would run out unwatched.
    const ended = (kind: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK') => {
      api.fetchActiveSession.mockResolvedValueOnce(running({ kind })).mockResolvedValue(null);
      api.transitionSession.mockResolvedValue(
        running({ kind, status: 'COMPLETED', dueAt: null, remainingSec: 0, endedAt: NOW }),
      );
      api.startSession.mockResolvedValue(running());
    };

    it('offers the short break a finished Pomodoro earned', async () => {
      api.fetchCycle.mockResolvedValue({ completedInCycle: 1, cyclesUntilLongBreak: 4 });
      ended('FOCUS');

      await renderScreen();
      await fireEvent.press(await screen.findByText('COMPLETE'));
      await fireEvent.press(await screen.findByText('START'));

      await waitFor(() => expect(api.startSession).toHaveBeenCalled());
      expect(api.startSession.mock.calls[0][0]).toMatchObject({ kind: 'SHORT_BREAK' });
    });

    // The fourth Pomodoro gets its short break like the other three: the long
    // one is the bridge to the next run, not the fourth block's rest.
    it('offers the short break even to the Pomodoro that closed the run', async () => {
      api.fetchCycle.mockResolvedValue({ completedInCycle: 3, cyclesUntilLongBreak: 4 });
      ended('FOCUS');

      await renderScreen();
      await fireEvent.press(await screen.findByText('COMPLETE'));
      await fireEvent.press(await screen.findByText('START'));

      await waitFor(() => expect(api.startSession).toHaveBeenCalled());
      expect(api.startSession.mock.calls[0][0]).toMatchObject({ kind: 'SHORT_BREAK' });
    });

    it('offers the long break once the block that closed the run is over', async () => {
      api.fetchCycle.mockResolvedValue({ completedInCycle: 4, cyclesUntilLongBreak: 4 });
      ended('SHORT_BREAK');

      await renderScreen();
      await fireEvent.press(await screen.findByText('COMPLETE'));
      await fireEvent.press(await screen.findByText('START'));

      await waitFor(() => expect(api.startSession).toHaveBeenCalled());
      expect(api.startSession.mock.calls[0][0]).toMatchObject({ kind: 'LONG_BREAK' });
    });

    it('offers work again once a break inside the run is over', async () => {
      api.fetchCycle.mockResolvedValue({ completedInCycle: 2, cyclesUntilLongBreak: 4 });
      ended('SHORT_BREAK');

      await renderScreen();
      await fireEvent.press(await screen.findByText('COMPLETE'));
      await fireEvent.press(await screen.findByText('START'));

      await waitFor(() => expect(api.startSession).toHaveBeenCalled());
      expect(api.startSession.mock.calls[0][0]).toMatchObject({ kind: 'FOCUS' });
    });

    // An abandoned Pomodoro earns no break — the server does not count it
    // either — so the screen stays where it was.
    it('offers no break after a cancelled Pomodoro', async () => {
      api.fetchCycle.mockResolvedValue({ completedInCycle: 1, cyclesUntilLongBreak: 4 });
      api.fetchActiveSession.mockResolvedValueOnce(running()).mockResolvedValue(null);
      api.transitionSession.mockResolvedValue(
        running({ status: 'CANCELLED', dueAt: null, remainingSec: 0, endedAt: NOW }),
      );
      api.startSession.mockResolvedValue(running());

      await renderScreen();
      await fireEvent.press(await screen.findByText('CANCEL'));
      await fireEvent.press(await screen.findByText('Cancel session'));
      await fireEvent.press(await screen.findByText('START'));

      await waitFor(() => expect(api.startSession).toHaveBeenCalled());
      expect(api.startSession.mock.calls[0][0]).toMatchObject({ kind: 'FOCUS' });
    });

    it('offers focus on a screen where nothing has run', async () => {
      api.fetchActiveSession.mockResolvedValue(null);
      api.startSession.mockResolvedValue(running());

      await renderScreen();
      await fireEvent.press(await screen.findByText('START'));

      await waitFor(() => expect(api.startSession).toHaveBeenCalled());
      expect(api.startSession.mock.calls[0][0]).toMatchObject({ kind: 'FOCUS' });
    });
  });
});
