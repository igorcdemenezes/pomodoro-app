import { AppState } from 'react-native';
import { focusManager } from '@tanstack/react-query';

/**
 * Teaches React Query when the app is in front of the user.
 *
 * It assumes a browser window and never learns that a phone was backgrounded,
 * so without this a screen resumed after an hour keeps showing whatever it had
 * when it was suspended. That matters most for the timer: a session can run out
 * while the app is not on screen, and the first frame after returning has to be
 * the truth from the server, not a snapshot of the past.
 */
export function startFocusManager(): () => void {
  const subscription = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });

  return () => subscription.remove();
}
