import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, TextInput, useTheme } from 'react-native-paper';

import { PROJECT_COLORS } from './project-types';
import type { Project } from './project-types';

interface ProjectDialogProps {
  /** The project being edited, or null to create one. Closed when undefined. */
  project?: Project | null;
  pending: boolean;
  onDismiss: () => void;
  onSubmit: (values: { name: string; color: string }) => void;
}

const MAX_NAME_LENGTH = 120;

export function ProjectDialog({ project, pending, onDismiss, onSubmit }: ProjectDialogProps) {
  const visible = project !== undefined;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{project ? 'Edit project' : 'New project'}</Dialog.Title>
        {/* Keyed by what is being edited, so opening the dialog mounts a fresh
            form rather than one still holding the previous project's name. */}
        {visible ? (
          <ProjectForm
            key={project?.id ?? 'new'}
            project={project}
            pending={pending}
            onDismiss={onDismiss}
            onSubmit={onSubmit}
          />
        ) : null}
      </Dialog>
    </Portal>
  );
}

function ProjectForm({
  project,
  pending,
  onDismiss,
  onSubmit,
}: Required<Pick<ProjectDialogProps, 'pending' | 'onDismiss' | 'onSubmit'>> & {
  project: Project | null;
}) {
  const [name, setName] = useState(project?.name ?? '');
  const [color, setColor] = useState<string>(project?.color ?? PROJECT_COLORS[0]);

  const trimmed = name.trim();
  const tooLong = trimmed.length > MAX_NAME_LENGTH;
  const valid = trimmed.length > 0 && !tooLong;

  return (
    <>
      <Dialog.Content style={styles.content}>
        <TextInput
          label="Name"
          // Paper does not derive one from the label, so the field would
          // otherwise be unnamed to a screen reader.
          accessibilityLabel="Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          autoFocus
          maxLength={MAX_NAME_LENGTH}
          error={tooLong}
        />
        <HelperText type="error" visible={tooLong}>
          Keep the name under {MAX_NAME_LENGTH} characters.
        </HelperText>

        <View style={styles.swatches}>
          {PROJECT_COLORS.map((value) => (
            <Swatch
              key={value}
              color={value}
              selected={value === color}
              onPress={() => setColor(value)}
            />
          ))}
        </View>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Cancel</Button>
        <Button
          onPress={() => onSubmit({ name: trimmed, color })}
          disabled={!valid || pending}
          loading={pending}
        >
          Save
        </Button>
      </Dialog.Actions>
    </>
  );
}

function Swatch({
  color,
  selected,
  onPress,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Colour ${color}`}
      style={[
        styles.swatch,
        { backgroundColor: color },
        selected && { borderColor: theme.colors.onSurface, borderWidth: 3 },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  content: { gap: 4 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderColor: 'transparent', borderWidth: 3 },
});
