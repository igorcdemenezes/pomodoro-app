import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';

import { PROJECT_COLORS } from '../theme/project-colors';
import { color, radius } from '../theme/tokens';
import { Button } from '../ui/button';
import { TextField } from '../ui/field';
import { Icon } from '../ui/icon';
import { Text } from '../ui/text';
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
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
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
  const [swatch, setSwatch] = useState<string>(project?.color ?? PROJECT_COLORS[0]);

  const trimmed = name.trim();
  const tooLong = trimmed.length > MAX_NAME_LENGTH;
  const valid = trimmed.length > 0 && !tooLong;

  return (
    <View style={styles.body}>
      <Text variant="personName">{project ? 'Edit project' : 'New project'}</Text>

      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        error={tooLong ? `Keep the name under ${MAX_NAME_LENGTH} characters.` : undefined}
        autoCapitalize="sentences"
        autoFocus
        maxLength={MAX_NAME_LENGTH}
      />

      <View style={styles.colours}>
        <Text variant="overline">COLOUR</Text>
        <View style={styles.swatches}>
          {PROJECT_COLORS.map((value) => (
            <Swatch
              key={value}
              colour={value}
              selected={value === swatch}
              onPress={() => setSwatch(value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <Button label="Cancel" variant="ghost" onPress={onDismiss} style={styles.action} />
        <Button
          label="Save"
          onPress={() => onSubmit({ name: trimmed, color: swatch })}
          disabled={!valid}
          loading={pending}
          style={styles.action}
        />
      </View>
    </View>
  );
}

/**
 * A colour choice, confirmed by a checkmark rather than by a ring.
 *
 * A ring alone would be the only marker of which slot is chosen, and the ring
 * around a dark swatch is exactly what a low-vision reader loses; the tick sits
 * inside the fill, where it has the swatch's own contrast behind it.
 */
function Swatch({
  colour,
  selected,
  onPress,
}: {
  colour: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Colour ${colour}`}
      style={({ pressed }) => [
        styles.swatch,
        { backgroundColor: colour },
        pressed && styles.pressed,
      ]}
    >
      {selected ? <Icon name="check" size={18} color={color.onAccent} strokeWidth={3} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dialog: { backgroundColor: color.surface, borderRadius: radius.card },
  body: { padding: 20, gap: 20 },
  colours: { gap: 10 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
});
