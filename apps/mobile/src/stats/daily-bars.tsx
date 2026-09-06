import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { color, font } from '../theme/tokens';
import { Card } from '../ui/surface';
import { Text } from '../ui/text';
import { formatDay, formatDuration } from './duration';
import type { DailyPoint } from './stats-types';

const PLOT_HEIGHT = 128;
/** Room above the top gridline for its label. */
const HEAD_ROOM = 18;
const EMPTY_BAR = 3;
/** Past this many days the axis cannot label every column. */
const DENSE_AT = 10;

/**
 * Focused minutes per calendar day.
 *
 * One series, so there is no legend and no categorical colour: the heading says
 * what the bars are, and a second hue would imply a distinction that does not
 * exist. Today is marked by its axis label and by its callout, never by a
 * colour of its own.
 *
 * A day with no focus keeps a hairline bar rather than disappearing — "you did
 * nothing on Tuesday" and "Tuesday is missing" are different claims, and only
 * one of them is true.
 *
 * A phone has no hover, so the tooltip is a tap: the callout sits above the
 * selected column and starts on the most recent day rather than on nothing.
 */
export function DailyBars({
  points,
  completed,
  abandoned = 0,
}: {
  points: DailyPoint[];
  completed?: number;
  abandoned?: number;
}) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  if (points.length === 0) return null;

  const peak = Math.max(...points.map((point) => point.focusedSeconds));
  const ceiling = niceCeiling(peak);
  const dense = points.length > DENSE_AT;
  const selected = selectedDay ?? points[points.length - 1].day;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text variant="sectionHeading">Focus per day</Text>
        {completed === undefined ? null : (
          <Text variant="caption" tone="secondary">
            {completed} {completed === 1 ? 'session' : 'sessions'}
            {abandoned > 0 ? ` · ${abandoned} abandoned` : ''}
          </Text>
        )}
      </View>

      <View style={styles.plot} accessibilityRole="image" accessibilityLabel="Focus per day">
        <View style={[styles.grid, styles.gridTop]} />
        <Text variant="micro" tone="secondary" style={styles.gridLabel}>
          {formatDuration(ceiling)}
        </Text>
        <View style={[styles.grid, styles.gridBase]} />

        <View style={styles.bars}>
          {points.map((point) => {
            const empty = point.focusedSeconds === 0;
            const height = empty
              ? EMPTY_BAR
              : Math.max(EMPTY_BAR, (point.focusedSeconds / ceiling) * (PLOT_HEIGHT - HEAD_ROOM));

            return (
              <Pressable
                key={point.day}
                style={styles.slot}
                onPress={() => setSelectedDay(point.day)}
                accessibilityLabel={`${formatDay(point.day)}: ${formatDuration(point.focusedSeconds)}`}
              >
                {point.day === selected && !empty ? (
                  <Text variant="numeralMicro" tone="accent" numberOfLines={1}>
                    {formatDuration(point.focusedSeconds)}
                  </Text>
                ) : null}
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: empty ? color.inkIcon : color.accent,
                      borderTopLeftRadius: empty ? 2 : 5,
                      borderTopRightRadius: empty ? 2 : 5,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.axis}>
        {points.map((point, index) => {
          const labelled = !dense || index === 0 || index === points.length - 1;
          const today = index === points.length - 1;

          return (
            <View key={point.day} style={styles.tick}>
              {labelled ? (
                <Text
                  variant="micro"
                  tone={today ? 'accent' : 'secondary'}
                  style={today ? styles.today : undefined}
                >
                  {dense ? dayOfMonth(point.day) : weekday(point.day)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/**
 * A round number at or above the tallest bar.
 *
 * The axis exists to be read, and `2h` is read where `1h 47m` — the exact peak
 * — is merely decoded. The bars are scaled to this rather than to the peak, so
 * the tallest one stops short of the gridline instead of touching it.
 */
function niceCeiling(peak: number): number {
  const steps = [900, 1800, 3600, 7200, 10_800, 14_400, 21_600, 28_800, 43_200];

  return steps.find((step) => step >= peak) ?? Math.ceil(peak / 3600) * 3600;
}

function weekday(day: string): string {
  const [year, month, date] = day.split('-').map(Number);

  return WEEKDAYS[new Date(year, month - 1, date).getDay()];
}

function dayOfMonth(day: string): string {
  return String(Number(day.split('-')[2]));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const styles = StyleSheet.create({
  card: { paddingTop: 18, paddingHorizontal: 16, paddingBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  plot: { height: PLOT_HEIGHT, marginTop: 16 },
  grid: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: color.cardBorder },
  gridTop: { top: HEAD_ROOM },
  gridBase: { bottom: 0 },
  gridLabel: { position: 'absolute', left: 0, top: 0 },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  slot: { flex: 1, maxWidth: 22, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  bar: { alignSelf: 'stretch' },
  axis: { flexDirection: 'row', gap: 2, paddingTop: 8 },
  tick: { flex: 1, maxWidth: 22, alignItems: 'center' },
  today: { fontFamily: font.bold },
});
