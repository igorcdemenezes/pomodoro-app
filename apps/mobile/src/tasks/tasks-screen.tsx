import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Dialog, Menu, Portal, Snackbar } from 'react-native-paper';

import { useGoBack } from '../navigation/use-go-back';
import { useProjects } from '../projects/use-projects';
import { color, font, radius, size } from '../theme/tokens';
import { Button, RoundButton } from '../ui/button';
import { Chip, ChipRow } from '../ui/chip';
import { HeaderAction, HeaderBar, Screen } from '../ui/screen';
import { EmptyState, ErrorState, LoadingState } from '../ui/states';
import { Text } from '../ui/text';
import { TaskRow } from './task-row';
import { TASK_STATUSES, TASK_STATUS_LABELS } from './task-types';
import type { Task, TaskStatus } from './task-types';
import { useTaskMutations, useTasks } from './use-tasks';

export function TasksScreen() {
  const router = useRouter();
  // Pushed from a project row or the dashboard; the fallback covers a link
  // straight into a project's tasks.
  const goBack = useGoBack('/projects');

  // Arriving from a project row pre-filters the list; the filter stays editable
  // from here, so the screen is one list rather than two.
  const params = useLocalSearchParams<{ projectId?: string }>();

  const [projectId, setProjectId] = useState<string | undefined>(params.projectId);
  const [status, setStatus] = useState<TaskStatus | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [acting, setActing] = useState<Task | null>(null);
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
    setActing(null);

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

  // The project a list is scoped to is named in the title, so the control that
  // changes it belongs beside the title — and the menu hangs off that control
  // rather than off a chip that would repeat what the title already says.
  const header = (
    <HeaderBar
      title={projectId ? (projectsById.get(projectId)?.name ?? 'Tasks') : 'Tasks'}
      onBack={goBack}
      action={
        <Menu
          visible={projectMenu}
          onDismiss={() => setProjectMenu(false)}
          anchor={
            <HeaderAction
              icon="filter"
              label="Filter by project"
              onPress={() => setProjectMenu(true)}
            />
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
      }
    />
  );

  if (tasks.isPending) return <LoadingState title="Loading your tasks…" />;

  if (tasks.isError) {
    return (
      <Screen header={header}>
        <ErrorState
          title="Could not load your tasks"
          description={tasks.error.message}
          onRetry={() => void tasks.refetch()}
          retrying={tasks.isFetching}
        />
      </Screen>
    );
  }

  return (
    <Screen header={header} contentStyle={styles.content}>
      <ChipRow>
        <Chip label="All" selected={status === undefined} onPress={() => setStatus(undefined)} />
        {TASK_STATUSES.map((value) => (
          <Chip
            key={value}
            label={TASK_STATUS_LABELS[value]}
            selected={status === value}
            onPress={() => setStatus(value)}
          />
        ))}
      </ChipRow>

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          accessibilityLabel="Add a task"
          placeholder="Add a task…"
          placeholderTextColor={color.inkSecondary}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={() => void add()}
          returnKeyType="done"
          selectionColor={color.accent}
        />
        <RoundButton
          icon="plus"
          iconSize={20}
          strokeWidth={2.4}
          background={color.accent}
          tint={color.onAccent}
          disabled={title.trim().length === 0 || mutations.pending}
          accessibilityLabel="Add task"
          onPress={() => void add()}
        />
      </View>

      <FlatList
        style={styles.flex}
        data={tasks.data}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
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
        renderItem={({ item, index }) => {
          const project = item.projectId ? projectsById.get(item.projectId) : undefined;

          return (
            <TaskRow
              task={item}
              projectName={project?.name}
              projectColor={project?.color}
              last={index === (tasks.data?.length ?? 0) - 1}
              onToggleDone={() => void setStatusOf(item, item.status === 'DONE' ? 'TODO' : 'DONE')}
              onFocus={() => router.push({ pathname: '/focus', params: { taskId: item.id } })}
              running={item.status === 'IN_PROGRESS'}
              onLongPress={() => setActing(item)}
            />
          );
        }}
      />

      <Portal>
        {/* Long-press opens the actions a row has no room to show. A sheet of
            buttons rather than a popup menu: the row it belongs to can be
            anywhere on screen, and a menu pinned to it would open off the edge
            as often as not. */}
        <Dialog visible={acting !== null} onDismiss={() => setActing(null)} style={styles.dialog}>
          <View style={styles.dialogBody}>
            <Text variant="personName" numberOfLines={2}>
              {acting?.title}
            </Text>
            {acting && acting.status !== 'IN_PROGRESS' ? (
              <Button
                label="Mark in progress"
                variant="tonal"
                onPress={() => void setStatusOf(acting, 'IN_PROGRESS')}
              />
            ) : null}
            {acting?.status === 'IN_PROGRESS' ? (
              <Button
                label="Move back to to-do"
                variant="tonal"
                onPress={() => void setStatusOf(acting, 'TODO')}
              />
            ) : null}
            <Button
              label="Delete task"
              variant="ghost"
              onPress={() => {
                const task = acting;
                setActing(null);
                setDeleting(task);
              }}
            />
          </View>
        </Dialog>

        <Dialog
          visible={deleting !== null}
          onDismiss={() => setDeleting(null)}
          style={styles.dialog}
        >
          <View style={styles.dialogBody}>
            <Text variant="personName">Delete this task?</Text>
            <Text variant="body" tone="secondary">
              Focus sessions already recorded against it are kept — they are detached, not deleted.
            </Text>
            <View style={styles.dialogActions}>
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => setDeleting(null)}
                style={styles.dialogAction}
              />
              <Button
                label="Delete task"
                onPress={() => void confirmDelete()}
                style={styles.dialogAction}
              />
            </View>
          </View>
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

function describe(code: string, message: string): string {
  return code === 'TASK_HAS_ACTIVE_SESSION'
    ? 'A session is running on this task. Finish or cancel it first.'
    : message;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8 },
  composer: {
    marginTop: 16,
    height: size.control,
    borderWidth: 1,
    borderColor: color.cardBorder,
    borderRadius: radius.control,
    backgroundColor: color.surface,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  composerInput: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 20,
    color: color.ink,
  },
  flex: { flex: 1 },
  list: { flexGrow: 1, paddingTop: 20 },
  dialog: { backgroundColor: color.surface, borderRadius: radius.card },
  dialogBody: { padding: 20, gap: 12 },
  dialogActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  dialogAction: { flex: 1 },
});
