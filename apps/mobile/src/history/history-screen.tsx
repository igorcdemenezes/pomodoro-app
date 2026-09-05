import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Divider,
  List,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';

import { SESSION_KIND_LABELS } from '../sessions/session-types';
import type { Session } from '../sessions/session-types';
import { formatDuration } from '../stats/duration';
import { useTasks } from '../tasks/use-tasks';
import { Screen } from '../ui/screen';
import { EmptyState, ErrorState, LoadingState } from '../ui/states';
import { formatClock, groupByDay } from './history-grouping';
import { HISTORY_RANGES, HISTORY_RANGE_LABELS } from './history-range';
import type { HistoryRange } from './history-range';
import { useHistory } from './use-history';

export function HistoryScreen() {
  const theme = useTheme();
  const [range, setRange] = useState<HistoryRange>('week');

  const history = useHistory(range);
  // Only to name the task a session was run against; the history itself carries
  // the id and nothing else.
  const tasks = useTasks({});

  const sessions = useMemo(
    () => history.data?.pages.flatMap((page) => page.items) ?? [],
    [history.data],
  );
  const sections = useMemo(() => groupByDay(sessions), [sessions]);
  const taskTitles = useMemo(
    () => new Map((tasks.data ?? []).map((task) => [task.id, task.title])),
    [tasks.data],
  );

  if (history.isPending) return <LoadingState title="Loading your history…" />;

  if (history.isError) {
    return (
      <Screen ignoreTopInset>
        <ErrorState
          title="Could not load your history"
          description={history.error.message}
          onRetry={() => void history.refetch()}
          retrying={history.isFetching}
        />
      </Screen>
    );
  }

  return (
    <Screen ignoreTopInset>
      <SegmentedButtons
        value={range}
        onValueChange={(value) => setRange(value as HistoryRange)}
        buttons={HISTORY_RANGES.map((value) => ({
          value,
          label: HISTORY_RANGE_LABELS[value],
        }))}
      />

      <SectionList
        testID="history-list"
        sections={sections}
        keyExtractor={(session) => session.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        refreshing={history.isRefetching}
        onRefresh={() => void history.refetch()}
        // Asking early enough that the next page usually lands before the user
        // reaches the end, rather than after they have already stopped.
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
        }}
        renderSectionHeader={({ section }) => (
          <Text variant="titleSmall" style={styles.day}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <List.Item
            title={
              item.taskId ? (taskTitles.get(item.taskId) ?? 'Task') : SESSION_KIND_LABELS[item.kind]
            }
            description={describe(item)}
            titleStyle={item.status === 'CANCELLED' ? styles.cancelled : undefined}
            left={(props) => <List.Icon {...props} icon={icon(item)} />}
            right={() => (
              <Text variant="labelLarge" style={styles.time}>
                {formatClock(item.startedAt)}
              </Text>
            )}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Nothing recorded yet"
            description={
              range === 'all'
                ? 'Finish a focus session and it shows up here.'
                : 'No session in this period. Try a wider one.'
            }
          />
        }
        ListFooterComponent={
          history.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator accessibilityLabel="Loading more sessions" />
            </View>
          ) : null
        }
      />

      {tasks.isError ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Task names could not be loaded; sessions are listed by kind.
        </Text>
      ) : null}
    </Screen>
  );
}

/**
 * What the session was and how much of it happened.
 *
 * Cancelled sessions report the time actually run, not the time booked — the
 * whole point of abandoning one is that it did not last as long as planned.
 */
function describe(session: Session): string {
  const parts = [SESSION_KIND_LABELS[session.kind], formatDuration(session.elapsedSec)];

  if (session.status === 'CANCELLED') parts.push('Cancelled');

  return parts.join(' · ');
}

function icon(session: Session): string {
  if (session.status === 'CANCELLED') return 'close-circle-outline';

  return session.kind === 'FOCUS' ? 'check-circle-outline' : 'coffee-outline';
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
  day: { paddingTop: 16, paddingBottom: 4 },
  time: { alignSelf: 'center' },
  cancelled: { textDecorationLine: 'line-through' },
  footer: { paddingVertical: 16 },
});
