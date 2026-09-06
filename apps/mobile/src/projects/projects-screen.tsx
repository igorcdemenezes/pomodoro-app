import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Menu, Snackbar } from 'react-native-paper';

import { formatDuration } from '../stats/duration';
import { useByProject } from '../stats/use-stats';
import { color, radius, size } from '../theme/tokens';
import { RoundButton } from '../ui/button';
import { Screen } from '../ui/screen';
import { Segmented } from '../ui/segmented';
import { EmptyState, ErrorState, LoadingState } from '../ui/states';
import { Card, Dot, Meter } from '../ui/surface';
import { Text } from '../ui/text';
import { ProjectDialog } from './project-dialog';
import type { Project } from './project-types';
import { useProjectMutations, useProjects } from './use-projects';

const TABS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
] as const;

type Tab = (typeof TABS)[number]['value'];

export function ProjectsScreen() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('active');
  // One request for both tabs: the split is a property of each project, not a
  // different list, and refetching to flip a filter would blank the screen.
  const projects = useProjects(true);
  const breakdown = useByProject('week');
  const mutations = useProjectMutations();

  // `undefined` keeps the dialog closed; `null` opens it empty; a project opens
  // it for editing.
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const focusByProject = useMemo(
    () => new Map((breakdown.data ?? []).map((item) => [item.projectId, item.focusedSeconds])),
    [breakdown.data],
  );
  const focusTotal = useMemo(
    () => (breakdown.data ?? []).reduce((total, item) => total + item.focusedSeconds, 0),
    [breakdown.data],
  );

  const shown = useMemo(
    () =>
      (projects.data ?? []).filter((project) =>
        tab === 'archived' ? project.archivedAt !== null : project.archivedAt === null,
      ),
    [projects.data, tab],
  );

  const submit = async (values: { name: string; color: string }) => {
    try {
      if (editing) await mutations.update({ id: editing.id, ...values });
      else await mutations.create(values);

      setEditing(undefined);
    } catch {
      // Surfaced by the snackbar below; the dialog stays open with the input
      // intact so a rejected name can be corrected rather than retyped.
    }
  };

  const toggleArchived = async (project: Project) => {
    setMenuFor(null);

    try {
      await mutations.update({ id: project.id, archived: project.archivedAt === null });
    } catch {
      // Same: reported by the snackbar.
    }
  };

  if (projects.isPending) return <LoadingState title="Loading your projects…" />;

  if (projects.isError) {
    return (
      <Screen bottomInset={false}>
        <ErrorState
          title="Could not load your projects"
          description={projects.error.message}
          onRetry={() => void projects.refetch()}
          retrying={projects.isFetching}
        />
      </Screen>
    );
  }

  const activeCount = (projects.data ?? []).filter((p) => p.archivedAt === null).length;
  const taskCount = (projects.data ?? []).reduce((total, p) => total + p.taskCount, 0);

  return (
    <Screen bottomInset={false}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text variant="pageTitle">Projects</Text>
          <Text variant="label" tone="secondary">
            {activeCount} active · {taskCount} tasks · {formatDuration(focusTotal)} this week
          </Text>
        </View>
        <RoundButton
          icon="plus"
          diameter={size.touch}
          iconSize={22}
          strokeWidth={2.2}
          background={color.accent}
          tint={color.onAccent}
          accessibilityLabel="New project"
          onPress={() => setEditing(null)}
        />
      </View>

      <View style={styles.tabs}>
        <Segmented options={TABS} value={tab} onChange={setTab} accessibilityLabel="Project list" />
      </View>

      <FlatList
        style={styles.flex}
        data={shown}
        keyExtractor={(project) => project.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={projects.isFetching}
        onRefresh={() => void projects.refetch()}
        ListEmptyComponent={
          tab === 'archived' ? (
            <EmptyState
              title="Nothing archived"
              description="Archiving a project hides it here without losing the focus time it holds."
            />
          ) : (
            <EmptyState
              title="No projects yet"
              description="Group your tasks under a project to see where your focus time goes."
              actionLabel="Create a project"
              onAction={() => setEditing(null)}
            />
          )
        }
        renderItem={({ item }) => {
          const focused = focusByProject.get(item.id) ?? 0;
          const share = focusTotal > 0 ? focused / focusTotal : 0;

          return (
            <Pressable
              onPress={() => router.push({ pathname: '/tasks', params: { projectId: item.id } })}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Card style={styles.card}>
                <View style={styles.cardHead}>
                  <Dot color={item.color} />
                  <Text variant="cardTitle" numberOfLines={1} style={styles.cardName}>
                    {item.name}
                  </Text>
                  <Text variant="numeralXs" tone="secondary">
                    {formatDuration(focused)} · {Math.round(share * 100)}%
                  </Text>
                  <Menu
                    visible={menuFor === item.id}
                    onDismiss={() => setMenuFor(null)}
                    anchor={
                      <RoundButton
                        icon="more"
                        diameter={size.chip}
                        iconSize={18}
                        strokeWidth={2.4}
                        accessibilityLabel={`Actions for ${item.name}`}
                        onPress={() => setMenuFor(item.id)}
                      />
                    }
                  >
                    <Menu.Item
                      leadingIcon="pencil"
                      title="Edit"
                      onPress={() => {
                        setMenuFor(null);
                        setEditing(item);
                      }}
                    />
                    <Menu.Item
                      leadingIcon={item.archivedAt ? 'archive-arrow-up' : 'archive-arrow-down'}
                      title={item.archivedAt ? 'Restore' : 'Archive'}
                      onPress={() => void toggleArchived(item)}
                    />
                  </Menu>
                </View>

                <View style={styles.cardFoot}>
                  <View style={styles.meter}>
                    <Meter fraction={share} color={item.color} />
                  </View>
                  <Text variant="caption" tone="secondary">
                    {describeCounts(item)}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />

      <ProjectDialog
        project={editing}
        pending={mutations.pending}
        onDismiss={() => setEditing(undefined)}
        onSubmit={(values) => void submit(values)}
      />

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

/**
 * Archiving keeps a project's recorded focus time, so an archived project still
 * says how much work it holds.
 */
function describeCounts(project: Project): string {
  const suffix = project.archivedAt ? ' · archived' : '';

  if (project.taskCount === 0) return `No tasks yet${suffix}`;

  const done = project.taskCount - project.openTaskCount;

  return `${project.taskCount} tasks · ${done} done${suffix}`;
}

function describe(code: string, message: string): string {
  return code === 'PROJECT_NAME_TAKEN' ? 'You already have a project with that name.' : message;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heading: { flex: 1, gap: 2 },
  tabs: { marginTop: 20 },
  flex: { flex: 1 },
  list: { flexGrow: 1, paddingTop: 20, gap: 12 },
  pressed: { opacity: 0.8 },
  card: { padding: 16, gap: 12, borderRadius: radius.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardName: { flex: 1 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meter: { flex: 1 },
});
