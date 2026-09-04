import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text, useTheme } from 'react-native-paper';

interface TimerDialProps {
  /** How much of the session is behind it, from 0 to 1. */
  progress: number;
  /** The countdown itself, already formatted. */
  time: string;
  caption: string;
  colour: string;
  size?: number;
  /** Drawn muted when there is nothing running, so idle never looks live. */
  dimmed?: boolean;
}

const STROKE_WIDTH = 14;

/**
 * The countdown, as a ring that empties.
 *
 * The ring carries the reading a glance needs — roughly how much is left, and
 * whether this is focus or a break, by colour — while the digits carry the
 * exact one. Neither holds any state: both are drawn from the number the caller
 * derived this frame.
 */
export function TimerDial({
  progress,
  time,
  caption,
  colour,
  size = 260,
  dimmed = false,
}: TimerDialProps) {
  const theme = useTheme();

  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const swept = Math.min(1, Math.max(0, progress));

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(swept * 100) }}
      accessibilityLabel={`${caption}, ${time} remaining`}
    >
      {/* Rotated so the ring starts at the top rather than at three o'clock. */}
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.surfaceVariant}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={dimmed ? theme.colors.outlineVariant : colour}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - swept)}
          fill="none"
          originX={size / 2}
          originY={size / 2}
          rotation={-90}
        />
      </Svg>

      <View style={styles.readout} pointerEvents="none">
        <Text
          variant="displayMedium"
          style={[styles.time, dimmed && { color: theme.colors.onSurfaceVariant }]}
        >
          {time}
        </Text>
        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {caption}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  svg: { position: 'absolute' },
  readout: { alignItems: 'center', gap: 4 },
  // Tabular figures stop the digits from shifting sideways every second.
  time: { fontVariant: ['tabular-nums'] },
});
