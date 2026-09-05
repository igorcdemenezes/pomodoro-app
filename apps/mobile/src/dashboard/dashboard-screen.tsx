import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Button, Divider, List, Text, useTheme } from 'react-native-paper';

import { authenticatedRequest } from '../api/authenticated-request';
import { useAuthStore } from '../auth/auth-store';
import type { UserProfile } from '../auth/auth-types';
import { useAuthActions } from '../auth/use-auth-actions';
import { formatDuration } from '../stats/duration';
import { StatTile } from '../stats/stat-tile';
import { useSummary } from '../stats/use-stats';
import { useTasks } from '../tasks/use-tasks';
import { Screen } from '../ui/screen';
import { ErrorState, LoadingState } from '../ui/states';

const MAX_TASKS_SHOWN = 3;

export function DashboardScreen() {
  const theme = useTheme();
  const setUser = useAuthStore((state) => state.setUser);
  const { signOut } = useAuthActions();

  // Fetched through the authenticated client on purpose: this is what exercises
  // the token being attached and the refresh rotating without the user noticing.
  const profile = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const user = await authenticatedRequest<UserProfile>('/me');
      setUser(user);
      return user;
    },
  });

  const summary = useSummary('week');
  const inProgress = useTasks({ status: 'IN_PROGRESS' });

  if (profile.isPending) return <LoadingState title="Loading your dashboard…" />;

  if (profile.isError) {
    return (
      <Screen>
        <ErrorState
          title="Could not load your profile"
          description={profile.error.message}
          onRetry={() => void profile.refetch()}
          retrying={profile.isFetching}
        />
        <Button mode="text" onPress={() => void signOut()}>
          Sign out
        </Button>
      </Screen>
    );
  }

  const tasks = (inProgress.data ?? []).slice(0, MAX_TASKS_SHOWN);

  return (
    <Screen scrollable>
      <Text variant="headlineMedium">Hello, {profile.data.name}</Text>

      {/* The figures are the point of the screen, so a failure to load them is
          shown where they would be rather than replacing everything else. */}
      {summary.isError ? (
        <ErrorState
          title="Could not load your figures"
          description={summary.error.message}
          onRetry={() => void summary.refetch()}
          retrying={summary.isFetching}
        />
      ) : (
        <View style={styles.tiles}>
          <StatTile
            hero
            label="Focused today"
            value={formatDuration(summary.data?.focusedSecondsToday ?? 0)}
            hint={
              summary.data ? `${formatDuration(summary.data.focusedSeconds)} this week` : undefined
            }
          />
          <StatTile
            label="Streak"
            value={summary.data ? `${summary.data.currentStreakDays}` : '—'}
            hint="days in a row"
          />
          <StatTile
            label="Sessions"
            value={summary.data ? `${summary.data.completedSessions}` : '—'}
            hint="completed this week"
          />
        </View>
      )}

      <Link href="/(app)/focus" asChild>
        <Button mode="contained" icon="play">
          Start a session
        </Button>
      </Link>

      <Divider />

      <Text variant="titleMedium">In progress</Text>
      {tasks.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Nothing in progress. Mark a task as in progress to see it here.
        </Text>
      ) : (
        tasks.map((task) => (
          <List.Item
            key={task.id}
            title={task.title}
            description={`${task.completedPomodoros}/${task.estimatedPomodoros} pomodoros`}
            left={(props) => <List.Icon {...props} icon="progress-clock" />}
          />
        ))
      )}

      <View style={styles.links}>
        <Link href="/(app)/tasks" asChild>
          <Button mode="contained-tonal" icon="check-circle-outline">
            Tasks
          </Button>
        </Link>
        <Link href="/(app)/projects" asChild>
          <Button mode="contained-tonal" icon="folder-outline">
            Projects
          </Button>
        </Link>
        <Link href="/(app)/statistics" asChild>
          <Button mode="contained-tonal" icon="chart-bar">
            Statistics
          </Button>
        </Link>
        <Link href="/(app)/history" asChild>
          <Button mode="contained-tonal" icon="history">
            History
          </Button>
        </Link>
      </View>

      <Link href="/server-settings" asChild>
        <Button mode="text">Server</Button>
      </Link>
      <Button mode="outlined" onPress={() => void signOut()}>
        Sign out
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  links: { gap: 8 },
});
