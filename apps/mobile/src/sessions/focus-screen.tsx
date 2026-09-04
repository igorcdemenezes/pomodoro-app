import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Button, SegmentedButtons, Snackbar, Text, useTheme } from 'react-native-paper';

import { serverNow } from '../api/server-clock';
import { useAuthStore } from '../auth/auth-store';
import { formatCountdown, hasExpired, progress } from './session-timing';
import { SESSION_KIND_LABELS, SESSION_KINDS } from './session-types';
import type { SessionKind } from './session-types';
import { useActiveSession } from './use-active-session';
import { useCountdown } from './use-countdown';
import { useSessionControls } from './use-session-controls';
import { sessionColors } from '../theme/theme';
import { Screen } from '../ui/screen';
import { ErrorState, LoadingState } from '../ui/states';
import { TimerDial } from '../ui/timer-dial';

const KEEP_AWAKE_TAG = 'pomodoro-session';

/**
 * Durations to preview while nothing is running. The server picks the real one
 * from the user's preferences — the request deliberately carries no duration —
 * so these only fill the dial before a profile has been fetched.
 */
const FALLBACK_DURATION_SEC: Record<SessionKind, number> = {
  FOCUS: 1500,
  SHORT_BREAK: 300,
  LONG_BREAK: 900,
};

export function FocusScreen() {
  const theme = useTheme();
  const profile = useAuthStore((state) => state.user);

  const active = useActiveSession();
  const controls = useSessionControls();

  const session = active.data ?? null;
  const remaining = useCountdown(session);

  const [kind, setKind] = useState<SessionKind>('FOCUS');
  const [notice, setNotice] = useState<string | null>(null);

  // Set when the user themselves ended the session, so the confirmation says
  // what happened rather than announcing that time ran out.
  const intent = useRef<string | null>(null);
  const wasExpiring = useRef(false);

  // The screen stays lit while a session runs: a Pomodoro is watched, and a
  // phone that sleeps mid-focus makes the timer feel like it stopped.
  useEffect(() => {
    if (session?.status !== 'RUNNING') return;

    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);

    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [session?.status]);

  // A session leaves the screen only once the server has settled it, so the
  // confirmation reports something that is already recorded.
  useEffect(() => {
    if (session) {
      wasExpiring.current = hasExpired(session, serverNow());
      return;
    }

    if (intent.current) {
      setNotice(intent.current);
      intent.current = null;
    } else if (wasExpiring.current) {
      setNotice('Time is up — the session was recorded.');
    }

    wasExpiring.current = false;
  }, [session, remaining]);

  const end = (label: string, run: () => void) => {
    intent.current = label;
    run();
  };

  if (active.isPending && !session) return <LoadingState title="Checking for a running session…" />;

  // A cached session is still worth showing while a refetch fails; an empty
  // screen would be a worse answer than a slightly old one.
  if (active.isError && !session) {
    return (
      <Screen ignoreTopInset>
        <ErrorState
          title="Could not reach your session"
          description={active.error.message}
          onRetry={() => void active.refetch()}
          retrying={active.isFetching}
        />
      </Screen>
    );
  }

  const previewDurationSec = profile
    ? {
        FOCUS: profile.focusDurationSec,
        SHORT_BREAK: profile.shortBreakSec,
        LONG_BREAK: profile.longBreakSec,
      }[kind]
    : FALLBACK_DURATION_SEC[kind];

  const dialKind = session?.kind ?? kind;

  return (
    <Screen scrollable ignoreTopInset>
      <TimerDial
        progress={session ? progress(session, serverNow()) : 0}
        time={formatCountdown(session ? remaining : previewDurationSec * 1000)}
        caption={session ? statusCaption(session.status) : SESSION_KIND_LABELS[dialKind]}
        colour={sessionColors[dialKind]}
        dimmed={!session}
      />

      {session ? (
        <View style={styles.controls}>
          {session.status === 'RUNNING' ? (
            <Button
              mode="contained-tonal"
              icon="pause"
              onPress={() => controls.pause(session.id)}
              disabled={controls.pending}
            >
              Pause
            </Button>
          ) : (
            <Button
              mode="contained"
              icon="play"
              onPress={() => controls.resume(session.id)}
              disabled={controls.pending}
            >
              Resume
            </Button>
          )}

          <Button
            mode="outlined"
            icon="check"
            onPress={() => end('Session completed.', () => controls.complete(session.id))}
            disabled={controls.pending}
          >
            Finish
          </Button>

          <Button
            mode="text"
            textColor={theme.colors.error}
            onPress={() => end('Session cancelled.', () => controls.cancel(session.id))}
            disabled={controls.pending}
          >
            Cancel session
          </Button>
        </View>
      ) : (
        <View style={styles.controls}>
          <SegmentedButtons
            value={kind}
            onValueChange={(value) => setKind(value as SessionKind)}
            buttons={SESSION_KINDS.map((value) => ({
              value,
              label: SESSION_KIND_LABELS[value],
              disabled: controls.pending,
            }))}
          />

          <Button
            mode="contained"
            icon="play"
            onPress={() => controls.start({ kind })}
            loading={controls.pending}
            disabled={controls.pending}
          >
            Start {SESSION_KIND_LABELS[kind].toLowerCase()}
          </Button>

          <Text variant="bodySmall" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
            The session runs on the server. Closing the app, switching devices or losing connection
            will not lose it.
          </Text>
        </View>
      )}

      <Snackbar
        visible={controls.error !== null}
        onDismiss={controls.clearError}
        action={{ label: 'Dismiss', onPress: controls.clearError }}
      >
        {controls.error ? describe(controls.error.code, controls.error.message) : ''}
      </Snackbar>

      <Snackbar visible={notice !== null} onDismiss={() => setNotice(null)} duration={4000}>
        {notice ?? ''}
      </Snackbar>
    </Screen>
  );
}

function statusCaption(status: string): string {
  return status === 'PAUSED' ? 'Paused' : 'Running';
}

/**
 * The API answers with a stable code, so the two conflicts a user can actually
 * cause are explained rather than shown as raw backend prose.
 */
function describe(code: string, message: string): string {
  switch (code) {
    case 'SESSION_ALREADY_ACTIVE':
      return 'A session is already running — it has been loaded here.';
    case 'INVALID_SESSION_TRANSITION':
      return 'That session already moved on. Showing its current state.';
    default:
      return message;
  }
}

const styles = StyleSheet.create({
  controls: { gap: 12, marginTop: 8 },
  hint: { textAlign: 'center', marginTop: 4 },
});
