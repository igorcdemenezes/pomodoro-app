import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  Divider,
  IconButton,
  List,
  Menu,
  Portal,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { useProjects } from '../projects/use-projects';
import { Screen } from '../ui/screen';
import { EmptyState, ErrorState, LoadingState } from '../ui/states';
import { TASK_STATUSES, TASK_STATUS_LABELS } from './task-types';
import type { Task, TaskStatus } from './task-types';
import { useTaskMutations, useTasks } from './use-tasks';

export function TasksScreen() {
  const theme = useTheme();

  // Arriving from a project row pre-filters the list; the filter stays editable
  // from here, so the screen is one list rather than two.
  const params = useLocalSearchParams<{ projectId?: string }>();

  const [projectId, setProjectId] = useState<string | undefined>(params.projectId);
  const [status, setStatus] = useState<TaskStatus | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [projectMenu, setProjectMenu] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const filter = useMemo(() => ({ projectId, status }), [projectId, status]);
  const tasks = useTasks(filter);
  // Archived projects included: a task filed under one still has to say where
  // it belongs.
  const projects = useProjects(true);
  const mutations = useTaskMutations();

  const projectsById = useMemo(
    () => new Map((projects.data ?? []).map((project) => [project.id, project])),
    [projects.data],
  );

  const add = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    try {
      // A task created while the list is filtered to a project lands in it.
      await mutations.create({ title: trimmed, ...(projectId ? { projectId } : {}) });
      setTitle('');
    } catch {
      // Reported by the snackbar; the text stays so it can be sent again.
    }
  };

  const setStatusOf = async (task: Task, next: TaskStatus) => {
    setMenuFor(null);

    try {
      await mutations.update({ id: task.id, status: next });
    } catch {
      // Reported by the snackbar.
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    const task = deleting;
    setDeleting(null);

    try {
      await mutations.remove(task.id);
    } catch {
      // Reported by the snackbar — a task running a session cannot be deleted.
    }
  };

  if (tasks.isPending) return <LoadingState title="Loading your tasks…" />;

  if (tasks.isError) {
    return (
      <Screen ignoreTopInset>
        <ErrorState
          title="Could not load your tasks"
          description={tasks.error.message}
          onRetry={() => void tasks.refetch()}
          retrying={tasks.isFetching}
        />
      </Screen>
    );
  }

  const projectFilterLabel = projectId
    ? (projectsById.get(projectId)?.name ?? 'Project')
    : 'All projects';

  return (
    <Screen ignoreTopInset>
      <TextInput
        mode="outlined"
        label="Add a task"
        // Paper does not derive one from the label.
        accessibilityLabel="Add a task"
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={() => void add()}
        returnKeyType="done"
        right={
          <TextInput.Icon icon="plus" accessibilityLabel="Add task" onPress={() => void add()} />
        }
      />

      <View style={styles.filters}>
        <Menu
          visible={projectMenu}
          onDismiss={() => setProjectMenu(false)}
          anchor={
            <Chip icon="folder-outline" onPress={() => setProjectMenu(true)}>
              {projectFilterLabel}
            </Chip>
          }
        >
          <Menu.Item
            title="All projects"
            onPress={() => {
              setProjectId(undefined);
              setProjectMenu(false);
            }}
          />
          {(projects.data ?? []).map((project) => (
            <Menu.Item
              key={project.id}
              title={project.name}
              onPress={() => {
                setProjectId(project.id);
                setProjectMenu(false);
              }}
            />
          ))}
        </Menu>

        {TASK_STATUSES.map((value) => (
          <Chip
            key={value}
            selected={status === value}
            showSelectedCheck={false}
            onPress={() => setStatus(status === value ? undefined : value)}
          >
            {TASK_STATUS_LABELS[value]}
          </Chip>
        ))}
      </View>

      <FlatList
        data={tasks.data}
        keyExtractor={(task) => task.id}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={styles.list}
        refreshing={tasks.isFetching}
        onRefresh={() => void tasks.refetch()}
        ListEmptyComponent={
          <EmptyState
            title="Nothing here"
            description={
              status || projectId
                ? 'No task matches this filter.'
                : 'Add a task above to start tracking focus against it.'
            }
          />
        }
        renderItem={({ item }) => {
          const done = item.status === 'DONE';
          const project = item.projectId ? projectsById.get(item.projectId) : undefined;

          return (
            <List.Item
              title={item.title}
              titleStyle={done ? styles.done : undefined}
              description={describeTask(item, project?.name)}
              left={() => (
                <Checkbox.Android
                  status={done ? 'checked' : 'unchecked'}
                  accessibilityLabel={`Mark ${item.title} as ${done ? 'to do' : 'done'}`}
                  onPress={() => void setStatusOf(item, done ? 'TODO' : 'DONE')}
                />
              )}
              right={() => (
                <Menu
                  visible={menuFor === item.id}
                  onDismiss={() => setMenuFor(null)}
                  anchor={
                    <IconButton
                      icon="dots-vertical"
                      accessibilityLabel={`Actions for ${item.title}`}
                      onPress={() => setMenuFor(item.id)}
                    />
                  }
                >
                  {item.status !== 'IN_PROGRESS' ? (
                    <Menu.Item
                      leadingIcon="progress-clock"
                      title="Mark in progress"
                      onPress={() => void setStatusOf(item, 'IN_PROGRESS')}
                    />
                  ) : null}
                  <Menu.Item
                    leadingIcon="delete-outline"
                    title="Delete"
                    onPress={() => {
                      setMenuFor(null);
                      setDeleting(item);
                    }}
                  />
                </Menu>
              )}
            />
          );
        }}
      />

      <Portal>
        <Dialog visible={deleting !== null} onDismiss={() => setDeleting(null)}>
          <Dialog.Title>Delete this task?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Focus sessions already recorded against it are kept — they are detached, not deleted.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleting(null)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={() => void confirmDelete()}>
              Delete task
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={mutations.error !== null}
        onDismiss={mutations.clearError}
        action={{ label: 'Dismiss', onPress: mutations.clearError }}
      >
        {mutations.error ? describe(mutations.error.code, mutations.error.message) : ''}
      </Snackbar>
    </Screen>
  );
}

function describeTask(task: Task, projectName?: string): string {
  const pomodoros = `${task.completedPomodoros}/${task.estimatedPomodoros} pomodoros`;

  return projectName ? `${projectName} · ${pomodoros}` : pomodoros;
}

function describe(code: string, message: string): string {
  return code === 'TASK_HAS_ACTIVE_SESSION'
    ? 'A session is running on this task. Finish or cancel it first.'
    : message;
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { flexGrow: 1 },
  done: { textDecorationLine: 'line-through' },
});
