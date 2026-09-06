import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { color, radius, size } from '../theme/tokens';
import { Icon } from './icon';
import type { IconName } from './icon';
import { Text } from './text';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}

/**
 * A filter, as one of a row of pills.
 *
 * Selection is a tinted fill with accent ink rather than a checkmark: the row
 * is short and always visible, so the answer to "which one is on" should be
 * readable from the shape of the row itself.
 *
 * 34px tall on purpose — the row would be top-heavy at 44 — with the missing
 * five pixels of target added back as hitSlop.
 */
export function Chip({ label, selected = false, onPress, icon }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={(size.touch - size.chip) / 2}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={14}
          color={selected ? color.accent : color.inkSecondary}
          strokeWidth={1.8}
        />
      ) : null}
      <Text variant="labelStrong" tone={selected ? 'accent' : 'secondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: {
    height: size.chip,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selected: { backgroundColor: color.accentContainer },
  unselected: { borderWidth: 1, borderColor: color.controlBorder },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
