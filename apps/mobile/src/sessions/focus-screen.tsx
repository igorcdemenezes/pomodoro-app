import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Snackbar } from 'react-native-paper';

import { serverNow } from '../api/server-clock';
import { useAuthStore } from '../auth/auth-store';
import { useProjects } from '../projects/use-projects';
import { useDaily } from '../stats/use-stats';
import { useTasks } from '../tasks/use-tasks';
import { color, radius, sessionColor, size } from '../theme/tokens';
import { Icon } from '../ui/icon';
import { Screen } from '../ui/screen';
import { ErrorState, LoadingState } from '../ui/states';
import { Card, Dot } from '../ui/surface';
import { Text } from '../ui/text';
import { TimerRing } from '../ui/timer-ring';
import { formatCountdown, hasExpired, progress } from './session-timing';
import { SESSION_KIND_LABELS, SESSION_KINDS } from './session-types';
import type { SessionKind } from './session-types';
import { TaskPicker } from './task-picker';
import { useActiveSession } from './use-active-session';
import { useCountdown } from './use-countdown';
import { useSessionControls } from './use-session-controls';
import { useSessionEndNotification } from './use-session-notification';

const KEEP_AWAKE_TAG = 'pomodoro-session';

/**
 * Durations to preview while nothing is running. The server picks the real one
 * from the user's preferences — the request deliberately carries no duration —
 * so these only fill the ring before a profile has been fetched.
 */
const FALLBACK_DURATION_SEC: Record<SessionKind, number> = {
  FOCUS: 1500,
  SHORT_BREAK: 300,
  LONG_BREAK: 900,
};

export function FocusScreen() {
  const params = useLocalSearchParams<{ taskId?: string }>();
  const profile = useAuthStore((state) => state.user);

  const active = useActiveSession();
  const controls = useSessionControls();

  const session = active.data ?? null;
  const remaining = useCountdown(session);

  // Booked with the operating system, so the end of a session reaches the user
  // with the app in the background — where a Pomodoro usually is.
  useSessionEndNotification(session);

  const [kind, setKind] = useState<SessionKind>('FOCUS');
  const [taskId, setTaskId] = useState<string | undefined>(params.taskId);
  const [notice, setNotice] = useState<string | null>(null);

  // Arriving from a task's play button has to land on *that* task even when
  // this tab is already mounted — which, being a tab, it usually is. Adjusting
  // during render rather than in an effect: an effect would paint the previous
  // task for a frame before correcting itself.
  const [arrivedWith, setArrivedWith] = useState(params.taskId);

  if (params.taskId !== arrivedWith) {
    setArrivedWith(params.taskId);
    if (params.taskId) setTaskId(params.taskId);
  }

  // Shares its cache entry with the tasks screen, so opening the timer after
  // editing a task does not refetch the list.
  const tasks = useTasks({});
  const projects = useProjects(true);
  const daily = useDaily('week');

  const openTasks = (tasks.data ?? []).filter((task) => task.status !== 'DONE');
  const chosenId = session?.taskId ?? taskId;
  const chosen = chosenId ? tasks.data?.find((task) => task.id === chosenId) : undefined;
  const chosenProject = chosen?.projectId
    ? projects.data?.find((project) => project.id === chosen.projectId)
    : undefined;

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
      <Screen bottomInset={false}>
        <ErrorState
          title="Could not reach your session"
          description={active.error.message}
          onRetry={() => void active.refetch()}
          retrying={active.isFetching}
        />
      </Screen>
    );
  }

  const durations = profile
    ? {
        FOCUS: profile.focusDurationSec,
        SHORT_BREAK: profile.shortBreakSec,
        LONG_BREAK: profile.longBreakSec,
      }
    : FALLBACK_DURATION_SEC;

  const shownKind = session?.kind ?? kind;
  const palette = sessionColor[shownKind];
  const durationSec = session?.durationSec ?? durations[shownKind];

  const cycles = profile?.cyclesUntilLongBreak ?? 4;
  // Where this session sits in the run up to a long break, counted from the
  // focus sessions actually recorded today rather than from anything held here:
  // the count has to survive the app being closed mid-cycle.
  const doneToday = daily.data?.at(-1)?.completedSessions ?? 0;
  const inCycle = cycles > 0 ? doneToday % cycles : 0;

  return (
    <>
      <Screen scrollable bottomInset={false} contentStyle={styles.content}>
        <View style={[styles.kindChip, { backgroundColor: palette.tint }]}>
          <Dot size={6} color={palette.fill} />
          <Text variant="eyebrow" color={palette.ink}>
            {SESSION_KIND_LABELS[shownKind].toUpperCase()}
          </Text>
        </View>

        <View style={styles.ring}>
          <TimerRing
            progress={session ? progress(session, serverNow()) : 0}
            time={formatCountdown(session ? remaining : durationSec * 1000)}
            caption={`of ${Math.round(durationSec / 60)} min`}
            colour={palette.fill}
            dimmed={!session}
            accessibilityLabel={
              session
                ? `${SESSION_KIND_LABELS[shownKind]}, ${formatCountdown(remaining)} remaining`
                : `${SESSION_KIND_LABELS[shownKind]}, not started`
            }
          />
        </View>

        <View
          style={styles.cycles}
          accessibilityLabel={`${inCycle} of ${cycles} focus sessions before a long break`}
        >
          {Array.from({ length: cycles }, (_, index) => (
            <View
              key={index}
              style={[
                styles.cycleBar,
                { backgroundColor: index < inCycle ? palette.fill : color.cardBorder },
              ]}
            />
          ))}
          <Text variant="caption" tone="secondary" style={styles.cycleCount}>
            {inCycle} / {cycles}
          </Text>
        </View>

        {session ? (
          chosen ? (
            <Card style={styles.taskCard}>
              <Dot color={chosenProject?.color} />
              <View style={styles.taskBody}>
                <Text variant="rowTitle" numberOfLines={2}>
                  {chosen.title}
                </Text>
                <Text variant="label" tone="secondary">
                  {chosenProject?.name ?? 'No project'} · {chosen.completedPomodoros} of{' '}
                  {chosen.estimatedPomodoros}
                </Text>
              </View>
            </Card>
          ) : null
        ) : (
          <View style={styles.setup}>
            <View style={styles.kinds}>
              {SESSION_KINDS.map((value) => (
                <KindOption
                  key={value}
                  kind={value}
                  selected={value === kind}
                  disabled={controls.pending}
                  onPress={() => setKind(value)}
                />
              ))}
            </View>

            {kind === 'FOCUS' ? (
              <TaskPicker
                tasks={openTasks}
                value={taskId}
                disabled={controls.pending}
                onChange={setTaskId}
              />
            ) : null}
          </View>
        )}

        <View style={styles.spacer} />

        {session ? (
          <View style={styles.controls}>
            <Control
              icon="close"
              label="CANCEL"
              onPress={() => end('Session cancelled.', () => controls.cancel(session.id))}
              disabled={controls.pending}
            />
            {session.status === 'RUNNING' ? (
              <Control
                primary
                icon="pause"
                label="PAUSE"
                tint={palette.fill}
                onPress={() => controls.pause(session.id)}
                disabled={controls.pending}
              />
            ) : (
              <Control
                primary
                icon="play"
                label="RESUME"
                tint={palette.fill}
                onPress={() => controls.resume(session.id)}
                disabled={controls.pending}
              />
            )}
            <Control
              icon="check"
              label="COMPLETE"
              onPress={() => end('Session completed.', () => controls.complete(session.id))}
              disabled={controls.pending}
            />
          </View>
        ) : (
          <View style={styles.controls}>
            <Control
              primary
              icon="play"
              label="START"
              tint={sessionColor[kind].fill}
              disabled={controls.pending}
              onPress={() =>
                controls.start({ kind, ...(kind === 'FOCUS' && taskId ? { taskId } : {}) })
              }
            />
          </View>
        )}

        <Text variant="caption" tone="secondary" style={styles.hint}>
          {session
            ? 'Screen stays awake · notification when it ends'
            : 'The session runs on the server — closing the app will not lose it'}
        </Text>
      </Screen>

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
    </>
  );
}

/**
 * One of the timer's round controls.
 *
 * The primary one is bigger and wears the session's colour; the two beside it
 * are neutral, because ending a Pomodoro early and finishing it are both
 * ordinary, and painting either red would make it look like a mistake.
 */
function Control({
  icon,
  label,
  onPress,
  disabled,
  primary = false,
  tint,
}: {
  icon: 'close' | 'check' | 'pause' | 'play';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  tint?: string;
}) {
  const diameter = primary ? 84 : 56;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [styles.control, (pressed || disabled) && styles.faded]}
    >
      <View
        style={[
          styles.controlMark,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: primary ? tint : color.control,
          },
        ]}
      >
        <Icon
          name={icon}
          size={primary ? 30 : 22}
          color={primary ? color.onAccent : color.inkSecondary}
          strokeWidth={1.8}
        />
      </View>
      <Text variant="control" tone={primary ? 'primary' : 'secondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * One of the three kinds a session can be, before one is running.
 *
 * Drawn as the same pill the timer wears while a session is on, in the same
 * colour that session would take: what is being chosen is what the next screen
 * will look like, so the control shows it rather than describing it.
 */
function KindOption({
  kind,
  selected,
  disabled,
  onPress,
}: {
  kind: SessionKind;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const palette = sessionColor[kind];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.kindOption,
        selected
          ? { backgroundColor: palette.tint }
          : { borderWidth: 1, borderColor: color.controlBorder },
        (pressed || disabled) && styles.faded,
      ]}
    >
      <Dot size={6} color={selected ? palette.fill : color.inkIcon} />
      <Text variant="labelStrong" color={selected ? palette.ink : color.inkSecondary}>
        {SESSION_KIND_LABELS[kind]}
      </Text>
    </Pressable>
  );
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
  content: { alignItems: 'center' },
  kindChip: {
    height: size.chip,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ring: { marginTop: 28 },
  cycles: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cycleBar: { width: 22, height: 4, borderRadius: 2 },
  cycleCount: { paddingLeft: 4 },
  taskCard: {
    marginTop: 28,
    alignSelf: 'stretch',
    padding: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskBody: { flex: 1, gap: 2 },
  setup: { marginTop: 28, alignSelf: 'stretch', gap: 16, alignItems: 'center' },
  kinds: { flexDirection: 'row', gap: 8 },
  kindOption: {
    height: size.chip,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  spacer: { flex: 1, minHeight: 28 },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 36 },
  control: { alignItems: 'center', gap: 10, width: 84 },
  controlMark: { alignItems: 'center', justifyContent: 'center' },
  faded: { opacity: 0.6 },
  hint: { marginTop: 20, textAlign: 'center' },
});
