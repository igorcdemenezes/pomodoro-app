import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';

import type { UserProfile } from '../auth/auth-types';
import * as profileApi from './profile-api';
import { ProfileScreen } from './profile-screen';

jest.mock('./profile-api');

// `asChild` hands the destination to the child, so a passthrough is enough.
jest.mock('expo-router', () => ({ Link: ({ children }: { children: ReactNode }) => children }));

// Prefixed with `mock` so the factory below may close over it.
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
    expect(screen.getByLabelText('Focus (minutes)').props.value).toBe('25');
    expect(screen.getByLabelText('Sessions until a long break').props.value).toBe('4');
  });

  it('sends only the preference that was changed', async () => {
    await renderScreen();

    await fireEvent.changeText(await screen.findByLabelText('Focus (minutes)'), '50');
    await fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ focusDurationSec: 3000 }));
    expect(await screen.findByText('Preferences saved.')).toBeOnTheScreen();
  });

  it('refuses a duration the API would refuse, without asking it', async () => {
    await renderScreen();

    await fireEvent.changeText(await screen.findByLabelText('Focus (minutes)'), '400');

    expect(screen.getByText('Between 1 and 240 minutes.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Save changes'));

    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('keeps the draft when the save fails, so it can be sent again', async () => {
    api.updateProfile.mockRejectedValue(new Error('offline'));

    await renderScreen();

    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Ada');
    await fireEvent.press(screen.getByText('Save changes'));

    expect(await screen.findByText('Could not reach the server.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Name').props.value).toBe('Ada');
  });

  it('signs out from here', async () => {
    await renderScreen();

    await fireEvent.press(await screen.findByText('Sign out'));

    expect(mockSignOut).toHaveBeenCalled();
  });
});
