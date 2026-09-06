import { Pressable, StyleSheet, View } from 'react-native';

import { color, radius } from '../theme/tokens';
import { Text } from './text';

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

/**
 * Two or three mutually exclusive views of the same list.
 *
 * Distinct from a chip row, which filters *within* a list: this switches which
 * list is on screen, so it is drawn as one control with a thumb rather than as
 * separate pills.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedProps<T>) {
  return (
    <View
      style={styles.container}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.thumb,
              pressed && !selected && styles.pressed,
            ]}
          >
            <Text variant="labelStrong" tone={selected ? 'accent' : 'secondary'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.cardBorder,
    borderRadius: radius.field,
  },
  segment: {
    flex: 1,
    height: 36,
    borderRadius: radius.inner,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { backgroundColor: color.accentContainer },
  pressed: { opacity: 0.6 },
});
