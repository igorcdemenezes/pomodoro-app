import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { projectColor } from '../theme/project-colors';
import { formatDuration } from './duration';
import type { ProjectBreakdown } from './stats-types';

/**
 * Where the focus went, ranked.
 *
 * Horizontal bars rather than a pie: the question is "which project got the
 * most", and lengths against a shared baseline answer that at a glance where
 * angles do not. Every row is labelled with its project's name, so identity is
 * never carried by colour alone — which is also what licenses the palette's
 * lower-contrast slots.
 *
 * The colour is the project's own, so a project keeps its colour when a filter
 * changes which projects are on screen.
 */
export function ProjectBars({ items }: { items: ProjectBreakdown[] }) {
  const theme = useTheme();

  const peak = Math.max(...items.map((item) => item.focusedSeconds), 0);

  if (peak === 0) return null;

  return (
    <View style={styles.container}>
      {items
        .filter((item) => item.focusedSeconds > 0)
        .map((item) => (
          <View key={item.projectId ?? 'unfiled'} style={styles.row}>
            <View style={styles.labels}>
              <Text variant="bodyMedium" numberOfLines={1} style={styles.name}>
                {item.projectName}
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {formatDuration(item.focusedSeconds)}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${(item.focusedSeconds / peak) * 100}%`,
                    // Sessions filed under no project get the neutral outline
                    // colour: "unfiled" is the absence of a project, not one
                    // more project competing for a hue.
                    backgroundColor: item.projectId
                      ? projectColor(item.color, theme.dark)
                      : theme.colors.outline,
                  },
                ]}
              />
            </View>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { gap: 4 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  name: { flexShrink: 1 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
});
