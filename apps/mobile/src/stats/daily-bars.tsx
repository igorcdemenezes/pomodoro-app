import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { formatDay, formatDuration } from './duration';
import type { DailyPoint } from './stats-types';

const CHART_HEIGHT = 140;
const EMPTY_BAR_HEIGHT = 2;

/**
 * Focused minutes per calendar day.
 *
 * One series, so there is no legend and no categorical colour: the heading says
 * what the bars are, and a second hue would imply a distinction that does not
 * exist. A day with no focus keeps a hairline bar rather than disappearing —
 * "you did nothing on Tuesday" and "Tuesday is missing" are different claims.
 *
 * A phone has no hover, so the tooltip is a tap: the reading for the selected
 * day sits above the chart, and defaults to the busiest day rather than to
 * nothing.
 */
export function DailyBars({ points }: { points: DailyPoint[] }) {
  const theme = useTheme();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  if (points.length === 0) return null;

  const peak = points.reduce((best, point) =>
    point.focusedSeconds > best.focusedSeconds ? point : best,
  );
  const selected = points.find((point) => point.day === selectedDay) ?? peak;

  return (
    <View style={styles.container}>
      <View style={styles.reading}>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {formatDay(selected.day)}
        </Text>
        <Text variant="titleLarge">{formatDuration(selected.focusedSeconds)}</Text>
      </View>

      <View style={styles.chart} accessibilityRole="image" accessibilityLabel="Focus per day">
        {points.map((point) => {
          const ratio = peak.focusedSeconds > 0 ? point.focusedSeconds / peak.focusedSeconds : 0;
          const empty = point.focusedSeconds === 0;

          return (
            <Pressable
              key={point.day}
              style={styles.slot}
              onPress={() => setSelectedDay(point.day)}
              accessibilityLabel={`${formatDay(point.day)}: ${formatDuration(point.focusedSeconds)}`}
            >
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(EMPTY_BAR_HEIGHT, ratio * CHART_HEIGHT),
                    backgroundColor: empty ? theme.colors.surfaceVariant : theme.colors.primary,
                    // Dimmed only once a day has actually been tapped: fading
                    // every other bar by default would read as a claim about
                    // the data rather than as a selection.
                    opacity: selectedDay === null || point.day === selectedDay || empty ? 1 : 0.55,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.axis}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {formatDay(points[0].day)}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {formatDay(points[points.length - 1].day)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  reading: { gap: 0 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 2 },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});
