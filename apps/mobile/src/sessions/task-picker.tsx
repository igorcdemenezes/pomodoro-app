import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Menu, Text, useTheme } from 'react-native-paper';

import type { Task } from '../tasks/task-types';

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
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const selected = tasks.find((task) => task.id === value);

  if (tasks.length === 0) {
    return (
      <Text variant="bodySmall" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
        Add a task to record this focus time against something.
      </Text>
    );
  }

  const choose = (taskId?: string) => {
    setOpen(false);
    onChange(taskId);
  };

  return (
    <View style={styles.row}>
      <Menu
        visible={open}
        onDismiss={() => setOpen(false)}
        anchor={
          <Button
            mode="outlined"
            icon="checkbox-marked-circle-outline"
            accessibilityLabel="Choose a task"
            disabled={disabled}
            onPress={() => setOpen(true)}
          >
            {selected ? selected.title : 'No task'}
          </Button>
        }
      >
        <Menu.Item title="No task" onPress={() => choose(undefined)} />
        {tasks.map((task) => (
          <Menu.Item key={task.id} title={task.title} onPress={() => choose(task.id)} />
        ))}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center' },
  hint: { textAlign: 'center' },
});
