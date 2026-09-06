import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { color, radius } from '../theme/tokens';

/** A white panel on the warm canvas. The only container in the system. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * The 8px mark that ties a row to a project or a session kind.
 *
 * Never the only carrier of identity — every dot sits next to the name it
 * stands for — which is what lets the project palette use hues that a
 * colourblind reader may not separate.
 */
export function Dot({ color: ink, size = 8 }: { color?: string; size?: number }) {
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2 },
        ink ? { backgroundColor: ink } : styles.hollowDot,
      ]}
    />
  );
}

/**
 * A share of a whole, as a bar.
 *
 * Given a `label` it is announced as a progress bar; without one it is
 * decoration for a figure already written beside it, and stays out of the
 * screen reader's way.
 */
export function Meter({
  fraction,
  color: ink,
  height = 4,
  label,
}: {
  fraction: number;
  color: string;
  height?: number;
  label?: string;
}) {
  const clamped = Math.min(1, Math.max(0, fraction));

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessibilityRole={label ? 'progressbar' : 'none'}
      accessibilityLabel={label}
      accessibilityValue={label ? { min: 0, max: 100, now: Math.round(clamped * 100) } : undefined}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: ink,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.cardBorder,
  },
  hollowDot: { borderWidth: 1, borderColor: color.inkIcon },
  track: { backgroundColor: color.cardBorder, overflow: 'hidden' },
});
