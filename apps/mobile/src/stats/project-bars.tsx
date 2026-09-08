import { StyleSheet, View } from 'react-native';

import { Dot, Meter } from '../ui/surface';
import { Text } from '../ui/text';
import type { ProjectBreakdown } from './stats-types';

/**
 * How far along each project is.
 *
 * One bar per project, filled to the share of its tasks that are done, so a
 * project with two of four tasks finished reads as a half-full bar and "50%".
 * Every row is labelled with its project's name, so identity is never carried
 * by colour alone.
 */
export function ProjectBars({ items }: { items: ProjectBreakdown[] }) {
  return (
    <View style={styles.container}>
      {items.map((item) => {
        const percent = Math.round(item.completionRate * 100);

        return (
          <View key={item.projectId} style={styles.row}>
            <View style={styles.labels}>
              <Dot color={item.color} />
              <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
                {item.projectName}
              </Text>
              <Text variant="numeralMicro" tone="secondary">
                {item.completedTaskCount} of {item.taskCount}{' '}
                {item.taskCount === 1 ? 'task' : 'tasks'} · {percent}%
              </Text>
            </View>
            <Meter
              fraction={item.completionRate}
              color={item.color}
              height={6}
              label={`${item.projectName}, ${percent}% of tasks done`}
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
