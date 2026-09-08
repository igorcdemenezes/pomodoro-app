import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Dialog, Portal, Snackbar } from 'react-native-paper';

import { serverNow } from '../api/server-clock';
import { useAuthStore } from '../auth/auth-store';
import { historyKey } from '../history/use-history';
import { useProjects } from '../projects/use-projects';
import { statsKey } from '../stats/use-stats';
import { tasksKey, useTasks } from '../tasks/use-tasks';
import { color, radius, sessionColor, size } from '../theme/tokens';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Screen } from '../ui/screen';
import { ErrorState, LoadingState } from '../ui/states';
import { Card, Dot } from '../ui/surface';
import { Text } from '../ui/text';
import { TimerRing } from '../ui/timer-ring';
import { formatCountdown, hasExpired, progress } from './session-timing';
import { SESSION_KIND_LABELS, SESSION_KINDS } from './session-types';
import type { SessionKind } from './session-types';
import { useActiveSession } from './use-active-session';
import { useCountdown } from './use-countdown';
import { cycleKey, useCycle, useResetCycle } from './use-cycle';
import { useSessionControls } from './use-session-controls';
import { useSessionEndNotification } from './use-session-notification';

const KEEP_AWAKE_TAG = 'pomodoro-session';

/**
 * One mark per Pomodoro, and the gap between them. The single long-break mark
 * takes the width all of them together took, so the row keeps its shape when
 * the scale changes underneath it.
 */
const MARK_WIDTH = 22;
const MARK_GAP = 10;

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
  const cycle = useCycle();
  const client = useQueryClient();

  const session = active.data ?? null;
  const remaining = useCountdown(session);

  // The run of Pomodoros up to the next long break, as the server counts it.
  // The profile only fills the length in while that answer is on its way, so a
  // cold screen draws the right number of marks instead of four by default.
  const cycles = Math.max(
    1,
    cycle.data?.cyclesUntilLongBreak ?? profile?.cyclesUntilLongBreak ?? 4,
  );
  // Marks are capped at the length of the run: skipping long breaks overshoots
  // the count, and a row that grew past its own end would say less than a full
  // one does.
  const done = Math.min(cycle.data?.completedInCycle ?? 0, cycles);
  // Until that answer exists the row is not drawn at all. A cached one usually
  // arrives with the app, but when there is none — first run, no connection, an
  // endpoint that answered an error — an empty row would read as a cycle at
  // zero, which is a claim about the user's day rather than an admission that
  // it has not been fetched.
  const knowsRun = cycle.data !== undefined;

  // Booked with the operating system, so the end of a session reaches the user
  // with the app in the background — where a Pomodoro usually is.
  useSessionEndNotification(session);

  const [kind, setKind] = useState<SessionKind>('FOCUS');
  const [taskId, setTaskId] = useState<string | undefined>(params.taskId);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // The run can be started over by hand — for the user who came back after a
  // long gap and is not the person who did those two Pomodoros any more. The
  // screen follows the server's answer, and offers focus: a new run begins with
  // work, whatever the old one was about to offer.
  const restart = useResetCycle(() => {
    setKind('FOCUS');
    setNotice('Run reset — the next Pomodoro starts a new run.');
  });

  // A task is chosen on the tasks screen, by its play button, never here: this
  // tab opened on its own is a plain focus session on nothing in particular.
  // The route is what says which task, so the screen follows it — including
  // back to none when the tab is entered from the tab bar. Adjusted during
  // render rather than in an effect: an effect would paint the previous task
  // for a frame before correcting itself.
  const [arrivedWith, setArrivedWith] = useState(params.taskId);

  if (params.taskId !== arrivedWith) {
    setArrivedWith(params.taskId);
    setTaskId(params.taskId);
    // A task's play button asks for a Pomodoro on that task, whatever the
    // screen was resting on: after a finished focus it offers the short break,
    // and a break started from there would carry no task at all.
    if (params.taskId) setKind('FOCUS');
  }

  // A session that arrived — started on another device — while the reset was
  // being weighed answers the question for it: the run is in use. Adjusted
  // during render, like the route above, so the question is not asked again
  // once that session is over.
  if (session && restarting) setRestarting(false);

  // Shares its cache entry with the tasks screen, so opening the timer after
  // editing a task does not refetch the list.
  const tasks = useTasks({});
  const projects = useProjects(true);

  const chosenId = session?.taskId ?? taskId;
  const chosen = chosenId ? tasks.data?.find((task) => task.id === chosenId) : undefined;
  const chosenProject = chosen?.projectId
    ? projects.data?.find((project) => project.id === chosen.projectId)
    : undefined;

  // Set when the user themselves ended the session, so the confirmation says
  // what happened rather than announcing that time ran out — and so an
  // abandoned Pomodoro is told apart from a finished one, which the method
  // rewards very differently.
  const intent = useRef<{ notice: string; cancelled: boolean } | null>(null);
  const wasExpiring = useRef(false);
  // The kind that was on screen while the session ran. Read once it is gone, to
  // offer what comes next; null when nothing ran here, so a launch onto an idle
  // screen offers focus rather than a break nobody earned.
  const ran = useRef<SessionKind | null>(null);

  // The screen stays lit while a session runs: a Pomodoro is watched, and a
  // phone that sleeps mid-focus makes the timer feel like it stopped.
  useEffect(() => {
    if (session?.status !== 'RUNNING') return;

    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);

    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [session?.status]);

  // Everything that happens when a session leaves the screen — which it does
  // only once the server has settled it, so all of this reports something that
  // is already recorded.
  useEffect(() => {
    if (session) {
      ran.current = session.kind;
      wasExpiring.current = hasExpired(session, serverNow());
      return;
    }

    if (intent.current) {
      setNotice(intent.current.notice);
    } else if (wasExpiring.current) {
      setNotice('Time is up — the session was recorded.');
    }

    if (ran.current) {
      // The session left while the question was open — its own deadline
      // passing, or another device ending it. Asking whether to give up on
      // something already recorded would be asking about nothing, and a
      // question left standing would reopen on the next session.
      setConfirming(false);
      // The run moved on — whether the user ended the session or the server
      // settled it once the deadline passed — so the row is asked for again,
      // and the screen moves on to whatever the method says comes next.
      void client.invalidateQueries({ queryKey: cycleKey });
      // So does everything counted from finished sessions. The tabs stay
      // mounted, so nothing else would ask again: the dashboard kept showing
      // the figures from before the Pomodoro until the app was reopened.
      void client.invalidateQueries({ queryKey: statsKey });
      void client.invalidateQueries({ queryKey: historyKey });
      void client.invalidateQueries({ queryKey: tasksKey });
      setKind(nextKind(ran.current, intent.current?.cancelled ?? false, done, cycles));
      ran.current = null;
    }

    intent.current = null;
    wasExpiring.current = false;
  }, [session, remaining, client, done, cycles]);

  const end = (notice: string, cancelled: boolean, run: () => void) => {
    intent.current = { notice, cancelled };
    run();
  };

  const failure = controls.error ?? restart.error;
  const clearFailure = () => {
    controls.clearError();
    restart.clearError();
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

  // The row is scaled to the phase on screen. Four marks while the run is being
  // earned; a single one once the long break is what the screen is about, since
  // that break happens once per run — four marks for it would be counting in a
  // unit that only comes round a quarter as often.
  const resting = shownKind === 'LONG_BREAK';
  const marks = resting ? 1 : cycles;
  // The session on screen is the mark being earned, so it fills as the ring
  // does: the focus session earns its Pomodoro, the long break earns the rest
  // that closes the run. A short break earns neither — it is part of the block
  // already marked — and leaves the row where the last focus left it.
  const earning =
    session && (resting || shownKind === 'FOCUS') ? progress(session, serverNow()) : 0;
  // A long break is owed once the run is complete, and is what clears it. The
  // notice is for the rest of the screen: once the break itself is what is being
  // shown, the row is already saying it.
  const longBreakDue = done >= cycles && !resting;

  // What cancelling would cost, read from the session on screen so the question
  // names the minutes actually at stake.
  const cost = cancelCost(
    shownKind,
    session ? Math.max(0, Math.floor((session.durationSec * 1000 - remaining) / 60000)) : 0,
    done,
    cycles,
  );

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

        {knowsRun ? (
          <View
            style={styles.cycles}
            accessibilityLabel={
              resting
                ? `Long break, ${Math.floor(earning)} of 1`
                : longBreakDue
                  ? `${done} of ${cycles} focus sessions done — a long break is next`
                  : `${done} of ${cycles} focus sessions before a long break`
            }
          >
            {Array.from({ length: marks }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.cycleBar,
                  resting && { width: cycles * MARK_WIDTH + (cycles - 1) * MARK_GAP },
                ]}
              >
                <View
                  style={[
                    styles.cycleFill,
                    {
                      backgroundColor: palette.fill,
                      width: `${fill(index, done, earning) * 100}%`,
                    },
                  ]}
                />
              </View>
            ))}
            <Text
              variant="caption"
              tone={longBreakDue ? 'primary' : 'secondary'}
              style={styles.cycleCount}
            >
              {resting
                ? `${Math.floor(earning)} / 1`
                : longBreakDue
                  ? 'Long break next'
                  : `${done} / ${cycles}`}
            </Text>
          </View>
        ) : null}

        {/* Only while nothing runs and there is a run to let go of. Mid-session
            the question of what a reset does to the running Pomodoro has no
            good answer, and at zero there is nothing to reset. */}
        {knowsRun && !session && done > 0 ? (
          <Pressable
            onPress={() => setRestarting(true)}
            disabled={restart.pending}
            accessibilityRole="button"
            accessibilityLabel="Start the run over"
            hitSlop={8}
            style={({ pressed }) => [styles.resetRun, (pressed || restart.pending) && styles.faded]}
          >
            <Icon name="refresh" size={14} color={color.inkSecondary} strokeWidth={2} />
            <Text variant="labelStrong" tone="secondary">
              Reset run
            </Text>
          </Pressable>
        ) : null}

        {chosen && shownKind === 'FOCUS' ? (
          <Card style={styles.taskCard}>
            <Dot color={chosenProject?.color} />
            <View style={styles.taskBody}>
              <Text variant="rowTitle" numberOfLines={2}>
                {chosen.title}
              </Text>
              <Text variant="label" tone="secondary">
                {chosenProject?.name ?? 'No project'}
              </Text>
            </View>
            {/* Once a session is running the task is part of what the server
                recorded, so it can only be let go before the timer starts. */}
            {session ? null : (
              <Pressable
                onPress={() => setTaskId(undefined)}
                disabled={controls.pending}
                accessibilityRole="button"
                accessibilityLabel="Focus without this task"
                hitSlop={10}
                style={({ pressed }) => pressed && styles.faded}
              >
                <Icon name="close" size={18} color={color.inkIcon} strokeWidth={2} />
              </Pressable>
            )}
          </Card>
        ) : null}

        {/* The phase is the method's to decide, not the user's — the run above
            already says where they are in it — so this row reports the answer
            instead of asking the question. The three are kept side by side
            because knowing which of them is next means little without the two
            it is not. */}
        {session ? null : (
          <View
            style={styles.kinds}
            accessible
            accessibilityLabel={`Up next: ${SESSION_KIND_LABELS[kind]}`}
          >
            {SESSION_KINDS.map((value) => (
              <KindMark key={value} kind={value} current={value === kind} />
            ))}
          </View>
        )}

        <View style={styles.spacer} />

        {session ? (
          <View style={styles.controls}>
            <Control
              icon="close"
              label="CANCEL"
              onPress={() => setConfirming(true)}
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
              onPress={() => end('Session completed.', false, () => controls.complete(session.id))}
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

      {session ? (
        <Portal>
          <Dialog visible={confirming} onDismiss={() => setConfirming(false)} style={styles.dialog}>
            <View style={styles.dialogBody}>
              <Text variant="personName">{cost.title}</Text>
              <Text variant="body" tone="secondary">
                {cost.body}
              </Text>
              <View style={styles.dialogActions}>
                <Button
                  label="Keep going"
                  variant="ghost"
                  onPress={() => setConfirming(false)}
                  style={styles.dialogAction}
                />
                <Button
                  label="Cancel session"
                  loading={controls.pending}
                  onPress={() => {
                    setConfirming(false);
                    end(cost.notice, true, () => controls.cancel(session.id));
                  }}
                  style={styles.dialogAction}
                />
              </View>
            </View>
          </Dialog>
        </Portal>
      ) : null}

      {session ? null : (
        <Portal>
          <Dialog visible={restarting} onDismiss={() => setRestarting(false)} style={styles.dialog}>
            <View style={styles.dialogBody}>
              <Text variant="personName">Start the run over?</Text>
              <Text variant="body" tone="secondary">
                {resetCost(done)}
              </Text>
              <View style={styles.dialogActions}>
                <Button
                  label="Keep the run"
                  variant="ghost"
                  onPress={() => setRestarting(false)}
                  style={styles.dialogAction}
                />
                <Button
                  label="Reset run"
                  loading={restart.pending}
                  onPress={() => {
                    setRestarting(false);
                    restart.reset();
                  }}
                  style={styles.dialogAction}
                />
              </View>
            </View>
          </Dialog>
        </Portal>
      )}

      <Snackbar
        visible={failure !== null}
        onDismiss={clearFailure}
        action={{ label: 'Dismiss', onPress: clearFailure }}
      >
        {failure ? describe(failure.code, failure.message) : ''}
      </Snackbar>

      <Snackbar visible={notice !== null} onDismiss={() => setNotice(null)} duration={4000}>
        {notice ?? ''}
      </Snackbar>
    </>
  );
}

/**
 * What cancelling the session on screen would cost, and what it would not.
 *
 * The count does not move when a session is cancelled: the interrupted Pomodoro
 * is void, so it earns no place in the run, and the ones already banked are not
 * taken away with it. On screen that reads as a button that did nothing, which
 * is the whole reason this text exists — the consequence is explained here,
 * while the user can still change their mind, rather than left to be inferred
 * from a row that stayed put.
 */
function cancelCost(
  kind: SessionKind,
  minutes: number,
  done: number,
  cycles: number,
): { title: string; body: string; notice: string } {
  const run = `the run stays at ${done} of ${cycles}`;

  if (kind === 'FOCUS') {
    // Only a focus session has minutes worth naming: they are the ones the
    // statistics would have kept.
    const spent =
      minutes >= 1 ? `The ${minutes} min so far are not recorded` : 'Nothing is recorded';

    return {
      title: 'Cancel this Pomodoro?',
      body: `${spent}, and ${run} — a Pomodoro counts only once it finishes.`,
      notice: 'Session cancelled — this Pomodoro did not count toward the run.',
    };
  }

  if (kind === 'LONG_BREAK') {
    return {
      title: 'Cancel this long break?',
      body: `Only a long break that finishes clears the run, so ${run} and the next one is still owed.`,
      notice: 'Long break cancelled — the run is still waiting to be cleared.',
    };
  }

  return {
    title: 'Cancel this break?',
    body: `Breaks are not what the run counts, so ${run} either way.`,
    notice: 'Break cancelled.',
  };
}

/**
 * What starting the run over would and would not do, so the user is not left to
 * find out from the statistics that nothing was lost — or from the row that the
 * long break they were owed is gone.
 */
function resetCost(done: number): string {
  const banked =
    done === 1 ? 'The Pomodoro done so far stays' : `The ${done} Pomodoros done so far stay`;

  return `${banked} in your statistics. Only the count toward the long break goes back to 0.`;
}

/**
 * What the screen moves to once a session ends.
 *
 * A block is a Pomodoro and the short break that closes it, and every Pomodoro
 * gets one — the fourth included. The long break is not that fourth block's
 * rest: it is the bridge between one run of four and the next, and it comes
 * after the block is finished rather than in place of its break.
 *
 * An abandoned Pomodoro earns nothing: the screen stays on focus, because the
 * session it was meant to be never happened, and the count on the server agrees.
 *
 * Offered, never started: the app says what comes next and the user decides
 * when. A break that began on its own while the phone was in a pocket would run
 * out unwatched — and a long break that ends unwatched clears the whole run.
 */
function nextKind(
  ended: SessionKind,
  cancelled: boolean,
  done: number,
  cycles: number,
): SessionKind {
  if (ended === 'FOCUS') return cancelled ? 'FOCUS' : 'SHORT_BREAK';

  // By the time a short break ends, the Pomodoro it belongs to has long been
  // counted — the run is asked for again the moment any session ends — so this
  // reads the finished block, not a stale one.
  if (ended === 'SHORT_BREAK') return done >= cycles ? 'LONG_BREAK' : 'FOCUS';

  return 'FOCUS';
}

/**
 * How much of one cycle mark is filled: whole for a Pomodoro already recorded,
 * and the running one's own progress for the mark being earned right now.
 */
function fill(index: number, done: number, earning: number): number {
  if (index < done) return 1;

  return index === done ? earning : 0;
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
 * One of the three kinds a session can be, with the one coming next marked.
 *
 * Nothing here is tappable. The next phase follows from the method and from the
 * run the server is counting, so offering three equal buttons would invite a
 * choice the screen has already made — and let a long break start on a run
 * nobody has earned, which the marks above cannot even draw.
 *
 * The current one is the same pill the timer wears while a session is on, in
 * the colour that session will take. The other two lose their border with their
 * affordance: an outline is what this design system uses to promise a tap.
 */
function KindMark({ kind, current }: { kind: SessionKind; current: boolean }) {
  const palette = sessionColor[kind];

  return (
    <View
      style={[styles.kindMark, current ? { backgroundColor: palette.tint } : styles.kindMarkIdle]}
    >
      <Dot size={6} color={current ? palette.fill : color.inkIcon} />
      <Text variant="labelStrong" color={current ? palette.ink : color.inkSecondary}>
        {SESSION_KIND_LABELS[kind]}
      </Text>
    </View>
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
  cycles: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: MARK_GAP },
  cycleBar: {
    width: MARK_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.cardBorder,
    overflow: 'hidden',
  },
  cycleFill: { height: '100%', borderRadius: 2 },
  cycleCount: { paddingLeft: 4 },
  resetRun: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  kinds: { marginTop: 28, flexDirection: 'row', gap: 8 },
  kindMark: {
    height: size.chip,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  kindMarkIdle: { opacity: 0.45 },
  spacer: { flex: 1, minHeight: 28 },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 36 },
  control: { alignItems: 'center', gap: 10, width: 84 },
  controlMark: { alignItems: 'center', justifyContent: 'center' },
  faded: { opacity: 0.6 },
  hint: { marginTop: 20, textAlign: 'center' },
  dialog: { backgroundColor: color.surface, borderRadius: radius.card },
  dialogBody: { padding: 20, gap: 12 },
  dialogActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  dialogAction: { flex: 1 },
});
