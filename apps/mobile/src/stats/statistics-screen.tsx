import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text, useTheme } from 'react-native-paper';

import { Screen } from '../ui/screen';
import { EmptyState, ErrorState, LoadingState } from '../ui/states';
import { DailyBars } from './daily-bars';
import { formatDuration } from './duration';
import { ProjectBars } from './project-bars';
import { StatTile } from './stat-tile';
import { STATS_RANGES, STATS_RANGE_LABELS } from './stats-types';
import type { StatsRange } from './stats-types';
import { useByProject, useDaily, useSummary } from './use-stats';

export function StatisticsScreen() {
  const theme = useTheme();
  const [range, setRange] = useState<StatsRange>('week');

  const summary = useSummary(range);
  const daily = useDaily(range);
  const byProject = useByProject(range);

  const queries = [summary, daily, byProject];

  if (queries.every((query) => query.isPending)) {
    return <LoadingState title="Loading your statistics…" />;
  }

  const failure = queries.find((query) => query.isError);

  if (failure?.isError && !summary.data) {
    return (
      <Screen ignoreTopInset>
        <ErrorState
          title="Could not load your statistics"
          description={failure.error.message}
          onRetry={() => {
            queries.forEach((query) => void query.refetch());
          }}
          retrying={queries.some((query) => query.isFetching)}
        />
      </Screen>
    );
  }

  const nothingYet = summary.data?.completedSessions === 0 && summary.data.cancelledSessions === 0;

  return (
    <Screen scrollable ignoreTopInset>
      {/* One control for the whole screen: the tiles, the chart and the
          breakdown all answer for the same window, so they cannot disagree. */}
      <SegmentedButtons
        value={range}
        onValueChange={(value) => setRange(value as StatsRange)}
        buttons={STATS_RANGES.map((value) => ({ value, label: STATS_RANGE_LABELS[value] }))}
      />

      {nothingYet ? (
        <EmptyState
          title="No sessions yet"
          description="Run a focus session and this fills in with where your time went."
        />
      ) : (
        <>
          <View style={styles.tiles}>
            <StatTile
              hero
              label="Focused"
              value={formatDuration(summary.data?.focusedSeconds ?? 0)}
              hint={STATS_RANGE_LABELS[range].toLowerCase()}
            />
            <StatTile
              label="Completed"
              value={`${summary.data?.completedSessions ?? 0}`}
              hint={`${summary.data?.cancelledSessions ?? 0} abandoned`}
            />
            <StatTile
              label="Completion"
              value={`${Math.round((summary.data?.completionRate ?? 0) * 100)}%`}
              hint="of sessions started"
            />
          </View>

          <Text variant="titleMedium">Focus per day</Text>
          {daily.data ? (
            <DailyBars points={daily.data} />
          ) : (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              The daily series could not be loaded.
            </Text>
          )}

          <Text variant="titleMedium">By project</Text>
          {byProject.data && byProject.data.length > 0 ? (
            <ProjectBars items={byProject.data} />
          ) : (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Link a session to a task to see where the time went.
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
