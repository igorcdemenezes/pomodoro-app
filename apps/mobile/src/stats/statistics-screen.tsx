import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Menu } from 'react-native-paper';

import { color, radius } from '../theme/tokens';
import { Icon } from '../ui/icon';
import { Screen } from '../ui/screen';
import { EmptyState, ErrorState, LoadingState } from '../ui/states';
import { Text } from '../ui/text';
import { DailyBars } from './daily-bars';
import { formatDuration } from './duration';
import { ProjectBars } from './project-bars';
import { STATS_RANGES, STATS_RANGE_LABELS } from './stats-types';
import type { StatsRange } from './stats-types';
import { useByProject, useDaily, usePreviousDaily, useSummary } from './use-stats';

export function StatisticsScreen() {
  const [range, setRange] = useState<StatsRange>('week');
  const [rangeMenu, setRangeMenu] = useState(false);

  const summary = useSummary(range);
  const daily = useDaily(range);
  const previous = usePreviousDaily(range);
  const byProject = useByProject(range);

  const queries = [summary, daily, byProject];

  if (queries.every((query) => query.isPending)) {
    return <LoadingState title="Loading your statistics…" />;
  }

  const failure = queries.find((query) => query.isError);

  if (failure?.isError && !summary.data) {
    return (
      <Screen bottomInset={false}>
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
  const focused = summary.data?.focusedSeconds ?? 0;
  // Both sides of the comparison come from the daily series rather than one
  // from the headline: a difference is only meaningful between two figures
  // measured the same way, and the trend has to be about the two windows, not
  // about which endpoint answered.
  const delta = daily.data && previous.data ? total(daily.data) - total(previous.data) : null;

  return (
    <Screen scrollable bottomInset={false}>
      <View style={styles.header}>
        <Text variant="pageTitle">Statistics</Text>

        {/* One control for the whole screen: the headline, the chart and the
            breakdown all answer for the same window, so they cannot disagree. */}
        <Menu
          visible={rangeMenu}
          onDismiss={() => setRangeMenu(false)}
          anchor={
            <Pressable
              onPress={() => setRangeMenu(true)}
              accessibilityRole="button"
              accessibilityLabel={`Period: ${STATS_RANGE_LABELS[range]}`}
              style={({ pressed }) => [styles.period, pressed && styles.pressed]}
            >
              <Text variant="labelStrong">{STATS_RANGE_LABELS[range]}</Text>
              <Icon name="chevronDown" size={16} color={color.inkSecondary} strokeWidth={2} />
            </Pressable>
          }
        >
          {STATS_RANGES.map((value) => (
            <Menu.Item
              key={value}
              title={STATS_RANGE_LABELS[value]}
              onPress={() => {
                setRange(value);
                setRangeMenu(false);
              }}
            />
          ))}
        </Menu>
      </View>

      {nothingYet ? (
        <EmptyState
          title="No sessions yet"
          description="Run a focus session and this fills in with where your time went."
        />
      ) : (
        <>
          <Text variant="overline" style={styles.headline}>
            FOCUSED THIS {STATS_RANGE_LABELS[range].toUpperCase()}
          </Text>

          <View style={styles.figure}>
            <Text variant="hero">{formatDuration(focused)}</Text>
            {delta !== null && Math.abs(delta) >= 60 ? (
              <View
                style={styles.delta}
                accessibilityLabel={`${formatDuration(Math.abs(delta))} ${
                  delta > 0 ? 'more' : 'less'
                } than the previous ${STATS_RANGE_LABELS[range].toLowerCase()}`}
              >
                <Icon
                  name={delta > 0 ? 'arrowUp' : 'arrowDown'}
                  size={14}
                  color={delta > 0 ? color.positive : color.inkSecondary}
                  strokeWidth={2.6}
                />
                <Text variant="labelStrong" tone={delta > 0 ? 'positive' : 'secondary'}>
                  {formatDuration(Math.abs(delta))}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.chart}>
            {daily.data ? (
              <DailyBars
                points={daily.data}
                completed={summary.data?.completedSessions}
                abandoned={summary.data?.cancelledSessions}
              />
            ) : (
              <Text variant="body" tone="secondary">
                The daily series could not be loaded.
              </Text>
            )}
          </View>

          <Text variant="overline" style={styles.section}>
            BY PROJECT
          </Text>
          {byProject.data && byProject.data.length > 0 ? (
            <ProjectBars items={byProject.data} />
          ) : (
            <Text variant="body" tone="secondary">
              Link a session to a task to see where the time went.
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}

function total(points: { focusedSeconds: number }[]): number {
  return points.reduce((sum, point) => sum + point.focusedSeconds, 0);
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  period: {
    height: 36,
    borderWidth: 1,
    borderColor: color.controlBorder,
    borderRadius: radius.pill,
    paddingLeft: 16,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pressed: { opacity: 0.7 },
  headline: { marginTop: 24 },
  figure: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  chart: { marginTop: 24 },
  section: { marginTop: 20, marginBottom: 12 },
});
