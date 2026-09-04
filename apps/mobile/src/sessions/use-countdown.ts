import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { serverNow } from '../api/server-clock';
import { remainingMs } from './session-timing';
import type { Session } from './session-types';

/**
 * Twice a second. The display has one-second resolution, so ticking on the
 * second would drift visibly against it; ticking faster would burn frames to
 * redraw the same number.
 */
const TICK_MS = 500;

/**
 * Milliseconds left, recomputed on every render.
 *
 * The tick holds no value — it only asks for another render, and the number is
 * derived from the session's deadline and the server's clock while rendering.
 * A tick that arrives late, early, or not at all therefore cannot make the
 * timer wrong; it can only make the screen slow to notice.
 */
export function useCountdown(session: Session | null | undefined): number {
  const [, requestRender] = useState(0);
  const status = session?.status;

  useEffect(() => {
    // A paused or finished session has a fixed number: there is nothing to tick
    // towards, and an interval would only wake the device for no reason.
    if (status !== 'RUNNING') return;

    const tick = () => requestRender((count) => count + 1);

    const interval = setInterval(tick, TICK_MS);

    // Timers are frozen while the app is backgrounded, so the first frame after
    // returning would otherwise be painted from a render that never happened.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [status]);

  return session ? remainingMs(session, serverNow()) : 0;
}
