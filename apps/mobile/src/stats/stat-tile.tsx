import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface StatTileProps {
  label: string;
  value: string;
  /** A short qualifier under the number, when the label alone is ambiguous. */
  hint?: string;
  /** The one figure the screen exists to answer; drawn larger. */
  hero?: boolean;
}

/**
 * A single number that needs no chart.
 *
 * The value wears an ink colour rather than a series colour: nothing here
 * encodes identity, so a coloured number would only imply a category that does
 * not exist.
 */
export function StatTile({ label, value, hint, hero = false }: StatTileProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.tile, hero && styles.hero, { backgroundColor: theme.colors.surfaceVariant }]}
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text variant={hero ? 'displaySmall' : 'headlineSmall'}>{value}</Text>
      {hint ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: '45%', borderRadius: 16, padding: 16, gap: 2 },
  hero: { flexBasis: '100%' },
});
