import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Menu } from 'react-native-paper';

import type { Task } from '../tasks/task-types';
import { color, radius, size } from '../theme/tokens';
import { Icon } from '../ui/icon';
import { Text } from '../ui/text';

interface TaskPickerProps {
  tasks: Task[];
  value?: string;
  disabled?: boolean;
  onChange: (taskId?: string) => void;
}

/**
 * What the next focus session is for.
 *
 * Only the tasks still open are offered: a session cannot be recorded against
 * work that is already finished without making the per-task pomodoro count say
 * something untrue.
 */
export function TaskPicker({ tasks, value, disabled, onChange }: TaskPickerProps) {
  const [open, setOpen] = useState(false);

  const selected = tasks.find((task) => task.id === value);

  if (tasks.length === 0) {
    return (
      <Text variant="label" tone="secondary" style={styles.hint}>
        Add a task to record this focus time against something.
      </Text>
    );
  }

  const choose = (taskId?: string) => {
    setOpen(false);
    onChange(taskId);
  };

  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      anchor={
        <Pressable
          onPress={() => setOpen(true)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Task: ${selected?.title ?? 'none'}`}
          style={({ pressed }) => [styles.control, (pressed || disabled) && styles.pressed]}
        >
          <View style={styles.body}>
            <Text variant="overline">TASK</Text>
            <Text variant="bodyStrong" numberOfLines={1}>
              {selected ? selected.title : 'No task'}
            </Text>
          </View>
          <Icon name="chevronDown" size={20} color={color.inkSecondary} strokeWidth={2} />
        </Pressable>
      }
    >
      <Menu.Item title="No task" onPress={() => choose(undefined)} />
      {tasks.map((task) => (
        <Menu.Item key={task.id} title={task.title} onPress={() => choose(task.id)} />
      ))}
    </Menu>
  );
}

const styles = StyleSheet.create({
  control: {
    alignSelf: 'stretch',
    minHeight: size.control,
    borderWidth: 1,
    borderColor: color.controlBorder,
    borderRadius: radius.field,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: { opacity: 0.7 },
  body: { flex: 1, gap: 2 },
  hint: { textAlign: 'center' },
});
