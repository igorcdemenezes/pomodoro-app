import { StyleSheet, View } from 'react-native';

import { color } from '../theme/tokens';
import { Dot, Meter } from '../ui/surface';
import { Text } from '../ui/text';
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
 * The bar is a share of the whole window, not of the leader, so the percentage
 * beside it and the length of it are the same statement made twice.
 */
export function ProjectBars({ items }: { items: ProjectBreakdown[] }) {
  const total = items.reduce((sum, item) => sum + item.focusedSeconds, 0);

  if (total === 0) return null;

  return (
    <View style={styles.container}>
      {items
        .filter((item) => item.focusedSeconds > 0)
        .map((item) => {
          const share = item.focusedSeconds / total;
          // Sessions filed under no project get the neutral icon grey:
          // "unfiled" is the absence of a project, not one more project
          // competing for a hue.
          const ink = item.projectId ? item.color : color.inkIcon;

          return (
            <View key={item.projectId ?? 'unfiled'} style={styles.row}>
              <View style={styles.labels}>
                <Dot color={ink} />
                <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
                  {item.projectName}
                </Text>
                <Text variant="numeralMicro" tone="secondary">
                  {formatDuration(item.focusedSeconds)} · {Math.round(share * 100)}%
                </Text>
              </View>
              <Meter
                fraction={share}
                color={ink}
                height={6}
                label={`${item.projectName}, ${Math.round(share * 100)}% of focus time`}
              />
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  row: { gap: 6 },
  labels: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1 },
});
