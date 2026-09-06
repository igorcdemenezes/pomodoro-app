import { StyleSheet, View } from 'react-native';

import { color } from '../theme/tokens';
import { Card } from '../ui/surface';
import { Text } from '../ui/text';

export interface Stat {
  value: string;
  label: string;
  /** Accent for the one figure worth singling out — never more than one. */
  emphasis?: boolean;
  /** Spells out the window when the label alone cannot. */
  accessibilityLabel?: string;
}

/**
 * Two or three figures that need no chart, in one card.
 *
 * They share a row because they answer one question between them; splitting
 * them into separate cards would imply three unrelated readings and spend three
 * times the vertical space saying so.
 */
export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <Card style={styles.card}>
      {stats.map((stat, index) => (
        <View key={stat.label} style={styles.cellWrapper}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <View
            style={styles.cell}
            accessibilityLabel={stat.accessibilityLabel ?? `${stat.value} ${stat.label}`}
          >
            <Text variant="numeral" tone={stat.emphasis ? 'accent' : 'primary'}>
              {stat.value}
            </Text>
            <Text variant="caption" tone="secondary">
              {stat.label}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'stretch' },
  cellWrapper: { flex: 1, flexDirection: 'row' },
  divider: { width: 1, backgroundColor: color.cardBorder, marginVertical: 14 },
  cell: { flex: 1, paddingVertical: 14, paddingHorizontal: 16, gap: 2 },
});
