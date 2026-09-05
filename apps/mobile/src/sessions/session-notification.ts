import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { serverNow } from '../api/server-clock';
import type { Session, SessionKind } from './session-types';

const CHANNEL_ID = 'session-end';

/**
 * Registered once for the process, next to the other platform managers.
 *
 * Without a handler the system swallows a notification that arrives while the
 * app is open — which is the common case here, since the phone is usually
 * sitting in front of the user with the timer on screen.
 */
export function startSessionNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    // Android decides how loudly to announce a notification from its channel,
    // not from the notification. Without one at high importance the end of a
    // session would arrive silently in the tray.
    void Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Session end',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    }).catch(() => {
      // Expo Go does not support every notification API; a missing channel
      // costs a quieter notification, not a broken screen.
    });
  }
}

/**
 * Books the end of a running session with the operating system.
 *
 * The delay is measured against the *server's* clock, not the device's: the
 * whole screen already refuses to trust the phone's idea of the time, and a
 * notification firing five minutes early would be the one place that leak
 * showed. It is scheduled as an interval rather than a date for the same
 * reason — a date would be re-interpreted against the device clock.
 *
 * Returns the identifier to cancel with, or null when there is nothing to book:
 * permission refused, deadline already passed, or an API this runtime lacks.
 */
export async function scheduleSessionEnd(session: Session): Promise<string | null> {
  if (!session.dueAt) return null;

  const seconds = (Date.parse(session.dueAt) - serverNow()) / 1000;

  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  if (!(await hasPermission())) return null;

  try {
    return await Notifications.scheduleNotificationAsync({
      content: contentFor(session.kind),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelSessionEnd(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Already delivered, or never really booked. Either way there is nothing
    // left to cancel.
  }
}

/** Asked for the first time a session is started, never on app launch. */
async function hasPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();

    if (current.granted) return true;
    if (!current.canAskAgain) return false;

    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

function contentFor(kind: SessionKind): Notifications.NotificationContentInput {
  if (kind === 'FOCUS') {
    return { title: 'Focus session finished', body: 'Time to step away for a bit.' };
  }

  return { title: 'Break over', body: 'Ready for the next focus session?' };
}
