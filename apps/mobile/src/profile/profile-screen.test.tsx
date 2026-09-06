import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';

import type { UserProfile } from '../auth/auth-types';
import * as profileApi from './profile-api';
import { ProfileScreen } from './profile-screen';

jest.mock('./profile-api');

// The server row probes the backend for real; under test there is none.
jest.mock('../api/health', () => ({
  healthQueryKey: ['health'],
  useHealth: () => ({ isSuccess: true, isPending: false }),
}));

// Prefixed with `mock` so the factories below may close over them.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const mockSignOut = jest.fn();
jest.mock('../auth/use-auth-actions', () => ({
  useAuthActions: () => ({ signOut: mockSignOut }),
}));

const api = jest.mocked(profileApi);

const PROFILE: UserProfile = {
  id: 'u1000000-0000-4000-8000-000000000001',
  email: 'demo@pomodoro.app',
  name: 'Demo',
  focusDurationSec: 1500,
  shortBreakSec: 300,
  longBreakSec: 900,
  cyclesUntilLongBreak: 4,
  createdAt: '2026-09-01T09:00:00.000Z',
};

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <PaperProvider>
      <QueryClientProvider client={client}>
        <ProfileScreen />
      </QueryClientProvider>
    </PaperProvider>,
  );
}

describe('profile screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    api.fetchProfile.mockResolvedValue(PROFILE);
    api.updateProfile.mockImplementation((input) =>
      Promise.resolve({ ...PROFILE, ...input, name: input.name ?? PROFILE.name }),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens on the preferences the server holds', async () => {
    await renderScreen();

    expect(await screen.findByText('demo@pomodoro.app')).toBeOnTheScreen();
    expect(screen.getByText('25 min')).toBeOnTheScreen();
    expect(screen.getByText('5 min')).toBeOnTheScreen();
    expect(screen.getByText('4')).toBeOnTheScreen();
  });

  it('sends only the preference that was changed', async () => {
    await renderScreen();

    // Focus moves in fives; one press is 25 to 30 minutes.
    await fireEvent.press(await screen.findByLabelText('Increase Focus'));

    expect(screen.getByText('30 min')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Save defaults'));

    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ focusDurationSec: 1800 }));
    expect(await screen.findByText('Preferences saved.')).toBeOnTheScreen();
  });

  it('cannot reach a duration the API would refuse', async () => {
    api.fetchProfile.mockResolvedValue({ ...PROFILE, focusDurationSec: 240 * 60 });

    await renderScreen();

    // The bound is enforced by the control rather than by a message after the
    // fact, so there is nothing to save and nothing to explain.
    await fireEvent.press(await screen.findByLabelText('Increase Focus'));

    expect(screen.getByText('240 min')).toBeOnTheScreen();
    expect(screen.queryByText('Save defaults')).not.toBeOnTheScreen();
  });

  it('keeps the name that was typed when the save fails, so it can be sent again', async () => {
    api.updateProfile.mockRejectedValue(new Error('offline'));

    await renderScreen();

    await fireEvent.press(await screen.findByLabelText('Edit your name'));
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Ada');
    await fireEvent.press(screen.getByText('Save'));

    expect(await screen.findByText('Could not reach the server.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Name').props.value).toBe('Ada');
  });

  it('signs out from here', async () => {
    await renderScreen();

    await fireEvent.press(await screen.findByText('Sign out'));

    expect(mockSignOut).toHaveBeenCalled();
  });
});
