import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';

import type { DailyPoint, ProjectBreakdown, Summary } from './stats-types';
import * as statsApi from './stats-api';
import { StatisticsScreen } from './statistics-screen';

jest.mock('./stats-api');

const api = jest.mocked(statsApi);

function summary(overrides: Partial<Summary> = {}): Summary {
  return {
    focusedSeconds: 5100,
    focusedSecondsToday: 1500,
    completedSessions: 8,
    cancelledSessions: 2,
    completionRate: 0.8,
    currentStreakDays: 3,
    tasksCompleted: 4,
    ...overrides,
  };
}

const DAILY: DailyPoint[] = [
  { day: '2026-09-01', focusedSeconds: 3000, completedSessions: 2 },
  { day: '2026-09-02', focusedSeconds: 0, completedSessions: 0 },
  { day: '2026-09-03', focusedSeconds: 5100, completedSessions: 3 },
];

const BY_PROJECT: ProjectBreakdown[] = [
  {
    projectId: 'p1000000-0000-4000-8000-000000000001',
    projectName: 'Deep Work',
    color: '#2A78D6',
    focusedSeconds: 5100,
    completedSessions: 3,
  },
  {
    projectId: null,
    projectName: 'No project',
    color: '#2A78D6',
    focusedSeconds: 1500,
    completedSessions: 1,
  },
];

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <PaperProvider>
      <QueryClientProvider client={client}>
        <StatisticsScreen />
      </QueryClientProvider>
    </PaperProvider>,
  );
}

describe('statistics screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    api.fetchSummary.mockResolvedValue(summary());
    api.fetchDaily.mockResolvedValue(DAILY);
    api.fetchByProject.mockResolvedValue(BY_PROJECT);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports the headline figures for the range', async () => {
    await renderScreen();

    // By label, not by text: 1h 25m is also the peak day and the top project,
    // and the assertion is about the tile.
    expect(await screen.findByLabelText('Focused: 1h 25m')).toBeOnTheScreen();
    expect(screen.getByLabelText('Completion: 80%')).toBeOnTheScreen();
    expect(screen.getByText('2 abandoned')).toBeOnTheScreen();
  });

  it('labels every day of the chart, including the ones with no focus', async () => {
    await renderScreen();

    // A day with nothing on it still has to be readable as a day that happened.
    expect(await screen.findByLabelText('2 Sep: —')).toBeOnTheScreen();
    expect(screen.getByLabelText('3 Sep: 1h 25m')).toBeOnTheScreen();
  });

  it('reads out the day that is tapped', async () => {
    await renderScreen();

    // The 2nd is not an axis end, so finding it proves the reading moved.
    await fireEvent.press(await screen.findByLabelText('2 Sep: —'));

    expect(screen.getByText('2 Sep')).toBeOnTheScreen();
  });

  it('names every project in the breakdown, so colour is never the only clue', async () => {
    await renderScreen();

    expect(await screen.findByText('Deep Work')).toBeOnTheScreen();
    expect(screen.getByText('No project')).toBeOnTheScreen();
  });

  it('asks the server again when the range changes', async () => {
    await renderScreen();

    await screen.findByLabelText('Completion: 80%');
    await fireEvent.press(screen.getByText('Month'));

    await waitFor(() => expect(api.fetchSummary).toHaveBeenCalledWith('month'));
    expect(api.fetchByProject).toHaveBeenCalledWith('month');
  });

  it('invites a first session instead of drawing empty charts', async () => {
    api.fetchSummary.mockResolvedValue(
      summary({ completedSessions: 0, cancelledSessions: 0, focusedSeconds: 0 }),
    );

    await renderScreen();

    expect(await screen.findByText('No sessions yet')).toBeOnTheScreen();
  });
});
