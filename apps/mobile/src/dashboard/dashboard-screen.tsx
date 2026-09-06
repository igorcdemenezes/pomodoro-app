import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuthActions } from '../auth/use-auth-actions';
import { useProfile } from '../profile/use-profile';
import { useProjects } from '../projects/use-projects';
import { formatDuration } from '../stats/duration';
import { StatRow } from '../stats/stat-row';
import { useDaily, useSummary } from '../stats/use-stats';
import { TaskRow } from '../tasks/task-row';
import type { Task } from '../tasks/task-types';
import { useTasks } from '../tasks/use-tasks';
import { color, radius } from '../theme/tokens';
import { Button, TextButton } from '../ui/button';
import { Screen } from '../ui/screen';
import { ErrorState, LoadingState } from '../ui/states';
import { Text } from '../ui/text';

const MAX_UP_NEXT = 3;

/**
 * The screen the app opens on.
 *
 * It answers one question — how much focus has happened today — and then offers
 * the shortest route back into work: the task already in progress, or the next
 * few waiting. Everything else on it is navigation.
 */
export function DashboardScreen() {
  const router = useRouter();
  const { signOut } = useAuthActions();

  const profile = useProfile();
  const summary = useSummary('week');
  const daily = useDaily('week');
  const projects = useProjects(true);
  const active = useTasks({ status: 'IN_PROGRESS' });
  const todo = useTasks({ status: 'TODO' });

  const projectsById = useMemo(
    () => new Map((projects.data ?? []).map((project) => [project.id, project])),
    [projects.data],
  );

  if (profile.isPending) return <LoadingState title="Loading your dashboard…" />;

  if (profile.isError) {
    return (
      <Screen bottomInset={false}>
        <ErrorState
          title="Could not load your dashboard"
          description={profile.error.message}
          onRetry={() => void profile.refetch()}
          retrying={profile.isFetching}
        />
        {/* Signing out lives on the Profile screen, which this state cannot
            reach. Without it a user whose session is somehow broken is stuck
            on a screen that only knows how to fail. */}
        <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
      </Screen>
    );
  }

  const sessionsToday = daily.data?.at(-1)?.completedSessions ?? 0;
  const activeTasks = active.data ?? [];
  const upNext = (todo.data ?? []).slice(0, MAX_UP_NEXT);

  const openFocus = (task?: Task) =>
    router.push(task ? { pathname: '/focus', params: { taskId: task.id } } : '/focus');

  const row = (task: Task, last: boolean, running: boolean) => {
    const project = task.projectId ? projectsById.get(task.projectId) : undefined;

    return (
      <TaskRow
        key={task.id}
        task={task}
        projectName={project?.name}
        projectColor={project?.color}
        running={running}
        last={last}
        onFocus={() => openFocus(task)}
        onPress={() => router.push({ pathname: '/tasks', params: { taskId: task.id } })}
      />
    );
  };

  return (
    <Screen scrollable bottomInset={false}>
      <View style={styles.header}>
        <View style={styles.greeting}>
          <Text variant="overline">{today().toUpperCase()}</Text>
          <Text variant="pageTitle" numberOfLines={1}>
            Hello, {firstName(profile.data.name)}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
        >
          <Text variant="captionStrong" tone="secondary">
            {initials(profile.data.name)}
          </Text>
        </Pressable>
      </View>

      {/* The figures are the point of the screen, so a failure to load them is
          reported where they would be rather than replacing everything else. */}
      {summary.isError ? (
        <View style={styles.figuresError}>
          <ErrorState
            title="Could not load your figures"
            description={summary.error.message}
            onRetry={() => void summary.refetch()}
            retrying={summary.isFetching}
          />
        </View>
      ) : (
        <>
          <View style={styles.figuresHead}>
            <Text variant="overline">FOCUSED TODAY</Text>
            <TextButton
              label="History"
              icon="chevronRight"
              onPress={() => router.push('/history')}
            />
          </View>

          <Text variant="hero">{formatDuration(summary.data?.focusedSecondsToday ?? 0)}</Text>

          <View style={styles.stats}>
            <StatRow
              stats={[
                {
                  value: `${sessionsToday}`,
                  label: 'sessions',
                  accessibilityLabel: `${sessionsToday} sessions completed today`,
                },
                {
                  value: `${summary.data?.currentStreakDays ?? 0}`,
                  label: 'day streak',
                  emphasis: true,
                },
                {
                  value: `${Math.round((summary.data?.completionRate ?? 0) * 100)}%`,
                  label: 'completed',
                  accessibilityLabel: `${Math.round(
                    (summary.data?.completionRate ?? 0) * 100,
                  )}% of sessions completed this week`,
                },
              ]}
            />
          </View>
        </>
      )}

      {activeTasks.length > 0 ? (
        <View style={styles.section}>
          <Text variant="overline">ACTIVE</Text>
          <View style={styles.list}>
            {activeTasks.map((task, index) => row(task, index === activeTasks.length - 1, true))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="overline">UP NEXT</Text>
        {upNext.length > 0 ? (
          <View style={styles.list}>
            {upNext.map((task, index) => row(task, index === upNext.length - 1, false))}
          </View>
        ) : (
          <Text variant="label" tone="secondary" style={styles.emptyNext}>
            Nothing waiting. Add a task and it shows up here.
          </Text>
        )}
      </View>

      <View style={styles.spacer} />

      <Button label="Start focus" icon="timer" onPress={() => openFocus()} />
    </Screen>
  );
}

/** `Thursday, 3 Sep` — the day as it is said, not as it is stored. */
function today(date: Date = new Date()): string {
  const weekday = WEEKDAYS[date.getDay()];

  return `${weekday}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * The greeting is a greeting, so it uses the name a person is called by rather
 * than the whole string the account was registered with.
 */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return '?';

  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { flex: 1, gap: 2 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  figuresHead: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stats: { marginTop: 18 },
  figuresError: { marginTop: 28, minHeight: 180 },
  section: { marginTop: 24, gap: 10 },
  list: { marginTop: -4 },
  emptyNext: { paddingVertical: 12 },
  spacer: { flex: 1, minHeight: 24 },
});
