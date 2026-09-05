import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import type * as NotificationsApi from 'expo-notifications';

import { serverNow } from '../api/server-clock';
import type { Session, SessionKind } from './session-types';

type NotificationsModule = typeof NotificationsApi;

const CHANNEL_ID = 'session-end';

let cached: NotificationsModule | null | undefined;

/**
 * Loaded on demand, and not at all where loading it is fatal.
 *
 * Expo Go on Android cannot have this package in memory: remote notifications
 * were removed from it in SDK 53, and `warnOfExpoGoPushUsage` throws from a
 * side effect the package runs on import rather than from the call that needs
 * them. A top-level import therefore takes the whole route module down — the
 * router then reports the screen as missing its default export, which buries
 * the real cause several errors deep.
 *
 * Catching that is not possible: Metro's `guardedLoadModule` wraps module
 * evaluation, hands anything thrown to `ErrorUtils.reportFatalError` and
 * returns undefined instead of rethrowing, so the red screen appears before a
 * `try` around the require could see it. The only way through is to never
 * require it here, which is what the guard below does. The check mirrors the
 * package's own: iOS in Expo Go merely warns, so it keeps working.
 *
 * The consequence is deliberate: in Expo Go the session still runs, only the
 * system notification is missing. A development build ships the native module
 * and behaves fully.
 */
function notifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;

  if (Platform.OS === 'android' && isRunningInExpoGo()) {
    cached = null;
    return cached;
  }

  // Still guarded, for a runtime that simply lacks the module: that failure
  // surfaces as an ordinary throw rather than through Metro's loader.
  try {
    // Deliberately a require: the load has to be synchronous to stay inside
    // this try, which is the whole point of not importing it at the top.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }

  return cached;
}

/**
 * Registered once for the process, next to the other platform managers.
 *
 * Without a handler the system swallows a notification that arrives while the
 * app is open — which is the common case here, since the phone is usually
 * sitting in front of the user with the timer on screen.
 */
export function startSessionNotifications(): void {
  const api = notifications();

  if (!api) return;

  api.setNotificationHandler({
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
    void api
      .setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Session end',
        importance: api.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      })
      .catch(() => {
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
  const api = notifications();

  if (!api) return null;
  if (!session.dueAt) return null;

  const seconds = (Date.parse(session.dueAt) - serverNow()) / 1000;

  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  if (!(await hasPermission(api))) return null;

  try {
    return await api.scheduleNotificationAsync({
      content: contentFor(session.kind),
      trigger: {
        type: api.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelSessionEnd(identifier: string): Promise<void> {
  const api = notifications();

  if (!api) return;

  try {
    await api.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Already delivered, or never really booked. Either way there is nothing
    // left to cancel.
  }
}

/** Asked for the first time a session is started, never on app launch. */
async function hasPermission(api: NotificationsModule): Promise<boolean> {
  try {
    const current = await api.getPermissionsAsync();

    if (current.granted) return true;
    if (!current.canAskAgain) return false;

    return (await api.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

function contentFor(kind: SessionKind): NotificationsApi.NotificationContentInput {
  if (kind === 'FOCUS') {
    return { title: 'Focus session finished', body: 'Time to step away for a bit.' };
  }

  return { title: 'Break over', body: 'Ready for the next focus session?' };
}
