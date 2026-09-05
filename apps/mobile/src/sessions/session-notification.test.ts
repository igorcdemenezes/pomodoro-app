import * as Notifications from 'expo-notifications';

import { recordServerTime, resetServerClock } from '../api/server-clock';
import type { Session } from './session-types';
import type * as SessionNotification from './session-notification';
import { scheduleSessionEnd } from './session-notification';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

const notifications = jest.mocked(Notifications);

const DEVICE_NOW = '2026-09-04T12:00:00.000Z';

function running(overrides: Partial<Session> = {}): Session {
  return {
    id: 'a5b6c7d8-0000-4000-8000-000000000001',
    taskId: null,
    kind: 'FOCUS',
    status: 'RUNNING',
    startedAt: DEVICE_NOW,
    durationSec: 1500,
    endedAt: null,
    elapsedSec: 0,
    remainingSec: 1500,
    dueAt: '2026-09-04T12:15:00.000Z',
    serverTime: DEVICE_NOW,
    ...overrides,
  };
}

describe('scheduling the end of a session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetServerClock();
    jest.useFakeTimers().setSystemTime(new Date(DEVICE_NOW));
    notifications.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
    notifications.scheduleNotificationAsync.mockResolvedValue('notification-1');
  });

  afterEach(() => {
    jest.useRealTimers();
    resetServerClock();
  });

  it('books the notification for the deadline', async () => {
    expect(await scheduleSessionEnd(running())).toBe('notification-1');

    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ seconds: 900, channelId: 'session-end' }),
      }),
    );
  });

  it('measures the delay against the server clock, not the device one', async () => {
    // The phone is five minutes fast. Counting from its own clock would fire the
    // notification five minutes early, which is the bug this whole layer exists
    // to prevent.
    const fivMinutesEarlierOnTheServer = '2026-09-04T11:55:00.000Z';
    const at = Date.parse(DEVICE_NOW);
    recordServerTime(fivMinutesEarlierOnTheServer, at, at);

    await scheduleSessionEnd(running());

    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: expect.objectContaining({ seconds: 1200 }) }),
    );
  });

  it('books nothing for a session whose deadline has already passed', async () => {
    expect(await scheduleSessionEnd(running({ dueAt: '2026-09-04T11:59:00.000Z' }))).toBeNull();
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('books nothing for a paused session, which has no deadline', async () => {
    expect(await scheduleSessionEnd(running({ status: 'PAUSED', dueAt: null }))).toBeNull();
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('gives up quietly when the user refuses notifications', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as never);
    notifications.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);

    expect(await scheduleSessionEnd(running())).toBeNull();
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('a runtime that cannot hold the package', () => {
  // Expo Go on Android throws from expo-notifications' own module scope, and
  // Metro turns that into a red screen the app cannot catch. The module must
  // therefore refuse to require it at all — this is the regression that took
  // down the root layout and the focus screen.
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetModules();
  });

  // Asserting that this is never called is the point. Letting the require run
  // and catching what it throws is not good enough: under Metro the throw never
  // reaches the caller, it reaches the red screen.
  const load = jest.fn();

  function loadInExpoGoOnAndroid() {
    load.mockClear();
    jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
    jest.doMock('expo', () => ({ isRunningInExpoGo: () => true }));
    jest.doMock('expo-notifications', () => {
      load();
      throw new Error('expo-notifications: removed from Expo Go');
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./session-notification') as typeof SessionNotification;
  }

  it('never loads the package under Expo Go on Android', () => {
    const module = loadInExpoGoOnAndroid();

    module.startSessionNotifications();

    expect(load).not.toHaveBeenCalled();
  });

  it('reports that nothing was booked instead of failing the screen', async () => {
    const module = loadInExpoGoOnAndroid();

    await expect(module.scheduleSessionEnd(running())).resolves.toBeNull();
    await expect(module.cancelSessionEnd('notification-1')).resolves.toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });
});
