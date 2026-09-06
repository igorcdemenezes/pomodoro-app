import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { color, size } from '../theme/tokens';
import { Text } from './text';

interface TimerRingProps {
  /** How much of the session is behind it, from 0 to 1. */
  progress: number;
  /** The countdown itself, already formatted. */
  time: string;
  /** What the countdown is out of: `of 25 min`. */
  caption: string;
  /** The session kind's fill. */
  colour: string;
  /** Drawn muted when there is nothing running, so idle never looks live. */
  dimmed?: boolean;
  accessibilityLabel?: string;
}

/**
 * The countdown, as a ring that fills.
 *
 * The ring carries the reading a glance needs — roughly how far in, and whether
 * this is focus or a break, by colour — while the digits carry the exact one.
 * Neither holds any state: both are drawn from the number the caller derived
 * this frame, which is itself derived from `startedAt + durationSec`. There is
 * no stored countdown anywhere in the app.
 *
 * The arc is drawn twice — once wide and faint, once at weight — so it glows
 * without a shadow, a gradient or a blur filter, none of which are dependable
 * across both platforms.
 */
export function TimerRing({
  progress,
  time,
  caption,
  colour,
  dimmed = false,
  accessibilityLabel,
}: TimerRingProps) {
  const radius = (size.ring - size.ringStroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const swept = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - swept);
  const ink = dimmed ? color.controlBorder : colour;

  const arc = {
    cx: size.ring / 2,
    cy: size.ring / 2,
    r: radius,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeDasharray: circumference,
    strokeDashoffset: offset,
    originX: size.ring / 2,
    originY: size.ring / 2,
    rotation: -90,
  };

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(swept * 100) }}
      accessibilityLabel={accessibilityLabel ?? `${time} remaining, ${caption}`}
    >
      {/* Rotated so the ring starts at twelve o'clock rather than at three. */}
      <Svg width={size.ring} height={size.ring} style={styles.svg}>
        <Circle
          cx={size.ring / 2}
          cy={size.ring / 2}
          r={radius}
          stroke={color.hairline}
          strokeWidth={size.ringStroke}
          fill="none"
        />
        <Circle {...arc} stroke={ink} strokeWidth={size.ringStroke * 2} opacity={0.16} />
        <Circle {...arc} stroke={ink} strokeWidth={size.ringStroke} />
      </Svg>

      <View style={styles.readout} pointerEvents="none">
        <Text variant="timer" tone={dimmed ? 'secondary' : 'primary'}>
          {time}
        </Text>
        <Text variant="label" tone="secondary">
          {caption}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: size.ring,
    height: size.ring,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  svg: { position: 'absolute' },
  readout: { alignItems: 'center', gap: 6 },
});
