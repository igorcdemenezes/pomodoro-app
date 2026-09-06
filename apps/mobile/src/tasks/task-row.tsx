import { Pressable, StyleSheet, View } from 'react-native';

import { color, size } from '../theme/tokens';
import { RoundButton } from '../ui/button';
import { Icon } from '../ui/icon';
import { Dot } from '../ui/surface';
import { Text } from '../ui/text';
import type { Task } from './task-types';

interface TaskRowProps {
  task: Task;
  /** Undefined for an unfiled task; the row then draws a hollow dot. */
  projectName?: string;
  projectColor?: string;
  /** Shown as the second line when the pomodoro count is not the point. */
  subtitle?: string;
  onToggleDone?: () => void;
  onFocus?: () => void;
  /** The task a session is currently running against. */
  running?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  last?: boolean;
}

/**
 * A task, as one line.
 *
 * The same row serves the dashboard and the task list: the checkbox appears
 * only where completing a task is one of the things the screen is for, and the
 * play affordance disappears on a task that is already done — a focus session
 * recorded against finished work would make its own pomodoro count untrue.
 */
export function TaskRow({
  task,
  projectName,
  projectColor,
  subtitle,
  onToggleDone,
  onFocus,
  running = false,
  onPress,
  onLongPress,
  last = false,
}: TaskRowProps) {
  const done = task.status === 'DONE';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, !last && styles.divided, pressed && styles.pressed]}
    >
      {onToggleDone ? (
        <Checkbox checked={done} label={task.title} onPress={onToggleDone} />
      ) : (
        <Dot color={projectColor} />
      )}

      <View style={styles.body}>
        <Text
          variant="rowTitle"
          tone={done ? 'secondary' : 'primary'}
          numberOfLines={2}
          style={done ? styles.done : undefined}
        >
          {task.title}
        </Text>
        <View style={styles.meta}>
          {onToggleDone ? <Dot color={projectColor} size={6} /> : null}
          <Text variant="label" tone="secondary" numberOfLines={1} style={styles.metaText}>
            {subtitle ?? describe(task, projectName)}
          </Text>
        </View>
      </View>

      {onFocus && !done ? (
        <RoundButton
          icon="play"
          iconSize={16}
          background={running ? color.accentContainer : 'transparent'}
          tint={running ? color.accent : color.inkIcon}
          accessibilityLabel={`Focus on ${task.title}`}
          onPress={onFocus}
        />
      ) : null}
    </Pressable>
  );
}

/**
 * The done control.
 *
 * Hand-drawn because the design's checked state is the sage confirmation green
 * rather than the brand red — red means FOCUS here, and a list of finished
 * tasks in the brand colour would read as a wall of alerts.
 */
function Checkbox({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={(size.touch - 22) / 2}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`Mark ${label} as ${checked ? 'to do' : 'done'}`}
      style={({ pressed }) => [styles.box, checked && styles.boxChecked, pressed && styles.pressed]}
    >
      {checked ? <Icon name="check" size={14} color={color.onAccent} strokeWidth={3.2} /> : null}
    </Pressable>
  );
}

function describe(task: Task, projectName?: string): string {
  const pomodoros = `${task.completedPomodoros} of ${task.estimatedPomodoros}`;

  return `${projectName ?? 'No project'} · ${pomodoros}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  divided: { borderBottomWidth: 1, borderBottomColor: color.hairline },
  pressed: { opacity: 0.7 },
  body: { flex: 1, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { flex: 1 },
  done: { textDecorationLine: 'line-through' },
  box: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: color.inkIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: color.positive, borderColor: color.positive },
});
