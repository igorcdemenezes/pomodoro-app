import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Divider,
  FAB,
  IconButton,
  List,
  Menu,
  Snackbar,
  Switch,
  Text,
  useTheme,
} from 'react-native-paper';

import { Screen } from '../ui/screen';
import { EmptyState, ErrorState, LoadingState } from '../ui/states';
import { ProjectDialog } from './project-dialog';
import type { Project } from './project-types';
import { useProjectMutations, useProjects } from './use-projects';

export function ProjectsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [includeArchived, setIncludeArchived] = useState(false);
  const projects = useProjects(includeArchived);
  const mutations = useProjectMutations();

  // `undefined` keeps the dialog closed; `null` opens it empty; a project opens
  // it for editing.
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);
  const [menuFor, setMenuFor] = useState<string | null>(null);

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
      <Screen ignoreTopInset>
        <ErrorState
          title="Could not load your projects"
          description={projects.error.message}
          onRetry={() => void projects.refetch()}
          retrying={projects.isFetching}
        />
      </Screen>
    );
  }

  return (
    <Screen ignoreTopInset>
      <View style={styles.filter}>
        <Text variant="bodyMedium">Show archived</Text>
        <Switch value={includeArchived} onValueChange={setIncludeArchived} />
      </View>

      <FlatList
        data={projects.data}
        keyExtractor={(project) => project.id}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={styles.list}
        refreshing={projects.isFetching}
        onRefresh={() => void projects.refetch()}
        ListEmptyComponent={
          <EmptyState
            title="No projects yet"
            description="Group your tasks under a project to see where your focus time goes."
            actionLabel="Create a project"
            onAction={() => setEditing(null)}
          />
        }
        renderItem={({ item }) => {
          const archived = item.archivedAt !== null;

          return (
            <List.Item
              title={item.name}
              titleStyle={archived ? { color: theme.colors.onSurfaceVariant } : undefined}
              description={describeCounts(item)}
              onPress={() =>
                router.push({ pathname: '/(app)/tasks', params: { projectId: item.id } })
              }
              left={() => <View style={[styles.dot, { backgroundColor: item.color }]} />}
              right={() => (
                <Menu
                  visible={menuFor === item.id}
                  onDismiss={() => setMenuFor(null)}
                  anchor={
                    <IconButton
                      icon="dots-vertical"
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
                    leadingIcon={archived ? 'archive-arrow-up' : 'archive-arrow-down'}
                    title={archived ? 'Restore' : 'Archive'}
                    onPress={() => void toggleArchived(item)}
                  />
                </Menu>
              )}
            />
          );
        }}
      />

      <FAB
        icon="plus"
        label="New project"
        accessibilityLabel="New project"
        onPress={() => setEditing(null)}
        style={styles.fab}
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

  return `${project.openTaskCount} open of ${project.taskCount}${suffix}`;
}

function describe(code: string, message: string): string {
  return code === 'PROJECT_NAME_TAKEN' ? 'You already have a project with that name.' : message;
}

const styles = StyleSheet.create({
  filter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  list: { flexGrow: 1, paddingBottom: 88 },
  dot: { width: 16, height: 16, borderRadius: 8, alignSelf: 'center', marginLeft: 8 },
  fab: { position: 'absolute', right: 20, bottom: 24 },
});
