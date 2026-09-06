import { useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { SESSION_KIND_LABELS } from '../sessions/session-types';
import type { Session } from '../sessions/session-types';
import { formatDuration } from '../stats/duration';
import { useTasks } from '../tasks/use-tasks';
import { color, radius, sessionColor } from '../theme/tokens';
import { Chip, ChipRow } from '../ui/chip';
import { HeaderBar, Screen } from '../ui/screen';
import { EmptyState, ErrorState, LoadingState } from '../ui/states';
import { Text } from '../ui/text';
import { formatClock, groupByDay } from './history-grouping';
import { HISTORY_RANGES, HISTORY_RANGE_LABELS } from './history-range';
import type { HistoryRange } from './history-range';
import { useHistory } from './use-history';

export function HistoryScreen() {
  const router = useRouter();
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

  const header = <HeaderBar title="History" onBack={() => router.back()} />;

  if (history.isPending) return <LoadingState title="Loading your history…" />;

  if (history.isError) {
    return (
      <Screen header={header}>
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
    <Screen header={header} contentStyle={styles.content}>
      <ChipRow>
        {HISTORY_RANGES.map((value) => (
          <Chip
            key={value}
            label={HISTORY_RANGE_LABELS[value]}
            selected={range === value}
            onPress={() => setRange(value)}
          />
        ))}
      </ChipRow>

      <SectionList
        style={styles.flex}
        testID="history-list"
        sections={sections}
        keyExtractor={(session) => session.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={history.isRefetching}
        onRefresh={() => void history.refetch()}
        // Asking early enough that the next page usually lands before the user
        // reaches the end, rather than after they have already stopped.
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
        }}
        renderSectionHeader={({ section }) => {
          // A day split across two pages would show a total computed from half
          // of it — and disagree with the Statistics screen, where the same
          // figure is aggregated in SQL over every session. Only the last
          // section can be short, and only while there is more to fetch.
          const partial = history.hasNextPage && section === sections[sections.length - 1];

          return (
            <View style={styles.day}>
              <Text variant="overline">{section.title.toUpperCase()}</Text>
              {partial ? null : (
                <Text variant="numeralMicro" tone="secondary">
                  {formatDuration(focusedSeconds(section.data))}
                </Text>
              )}
            </View>
          );
        }}
        renderItem={({ item }) => {
          const cancelled = item.status === 'CANCELLED';

          return (
            <View style={styles.row}>
              <View
                style={[
                  styles.bar,
                  {
                    backgroundColor: cancelled ? color.controlBorder : sessionColor[item.kind].fill,
                  },
                ]}
              />
              <View style={styles.body}>
                <View style={styles.titleRow}>
                  <Text variant="bodyStrong" tone={cancelled ? 'secondary' : 'primary'}>
                    {describe(item)}
                  </Text>
                  {cancelled ? (
                    <Text variant="badge" tone="secondary" style={styles.badge}>
                      CANCELLED
                    </Text>
                  ) : null}
                </View>
                <Text variant="label" tone="secondary" numberOfLines={1}>
                  {item.taskId ? (taskTitles.get(item.taskId) ?? 'Task') : 'No task'}
                </Text>
              </View>
              <Text variant="numeralMicro" tone="secondary">
                {formatClock(item.startedAt)}
              </Text>
            </View>
          );
        }}
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
              <ActivityIndicator accessibilityLabel="Loading more sessions" color={color.accent} />
            </View>
          ) : null
        }
      />

      {tasks.isError ? (
        <Text variant="caption" tone="secondary">
          Task names could not be loaded; sessions are listed by kind.
        </Text>
      ) : null}
    </Screen>
  );
}

/**
 * The focus time a day actually holds.
 *
 * Breaks and abandoned sessions are excluded so the figure means the same thing
 * as the one on the Statistics screen; a day header that counted rest as focus
 * would quietly contradict the chart two taps away.
 */
function focusedSeconds(sessions: Session[]): number {
  return sessions
    .filter((session) => session.kind === 'FOCUS' && session.status === 'COMPLETED')
    .reduce((total, session) => total + session.elapsedSec, 0);
}

/**
 * What the session was and how much of it happened.
 *
 * A cancelled session reports the time actually run against the time booked —
 * the whole point of abandoning one is that it did not last as long as planned,
 * and `6 of 25 min` says that where a bare `6 min` would not.
 */
function describe(session: Session): string {
  const label = SESSION_KIND_LABELS[session.kind];
  const booked = Math.round(session.durationSec / 60);

  if (session.status === 'CANCELLED') {
    return `${label} · ${Math.round(session.elapsedSec / 60)} of ${booked} min`;
  }

  return `${label} · ${booked} min`;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8 },
  flex: { flex: 1 },
  list: { flexGrow: 1, paddingBottom: 8 },
  day: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 22,
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
  },
  bar: { width: 3, height: 34, borderRadius: 2 },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    borderWidth: 1,
    borderColor: color.controlBorder,
    borderRadius: radius.inner - 4,
    paddingHorizontal: 6,
  },
  footer: { paddingVertical: 16 },
});
