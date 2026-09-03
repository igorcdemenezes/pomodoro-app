import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';

interface StateProps {
  title: string;
  description?: string;
}

/** Shown while a screen has nothing to render yet. */
export function LoadingState({ title = 'Loading…' }: Partial<StateProps>) {
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <ActivityIndicator size="large" />
      <Text variant="bodyMedium">{title}</Text>
    </View>
  );
}

/**
 * Shown when a screen succeeded but has nothing in it.
 *
 * Distinct from the error state on purpose: "you have no projects yet" and
 * "we could not load your projects" ask the user for completely different
 * things, and collapsing them into one message is how an app teaches people to
 * distrust it.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: StateProps & { actionLabel?: string; onAction?: () => void }) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text variant="titleMedium">{title}</Text>
      {description ? (
        <Text
          variant="bodyMedium"
          style={[styles.centered, { color: theme.colors.onSurfaceVariant }]}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button mode="contained-tonal" onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  retrying = false,
}: Partial<StateProps> & { onRetry?: () => void; retrying?: boolean }) {
  const theme = useTheme();

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text variant="titleMedium" style={{ color: theme.colors.error }}>
        {title}
      </Text>
      {description ? (
        <Text variant="bodyMedium" style={styles.centered}>
          {description}
        </Text>
      ) : null}
      {onRetry ? (
        <Button mode="contained" onPress={onRetry} loading={retrying} disabled={retrying}>
          Try again
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centered: { textAlign: 'center' },
});
