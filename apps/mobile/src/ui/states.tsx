import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { color } from '../theme/tokens';
import { Button } from './button';
import { Text } from './text';

/** Shown while a screen has nothing to render yet. */
export function LoadingState({ title = 'Loading…' }: { title?: string }) {
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={color.accent} />
      <Text variant="label" tone="secondary">
        {title}
      </Text>
    </View>
  );
}

/**
 * Shown when a screen succeeded but has nothing in it.
 *
 * Distinct from the error state on purpose: "you have no projects yet" and "we
 * could not load your projects" ask the user for completely different things,
 * and collapsing them into one message is how an app teaches people to distrust
 * it.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text variant="sectionHeading">{title}</Text>
      {description ? (
        <Text variant="body" tone="secondary" style={styles.centered}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="tonal" onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  retrying = false,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      {/* The one place the accent means trouble rather than brand — and it is
          carried by a heading with words, never by colour alone. */}
      <Text variant="sectionHeading" tone="accent">
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="secondary" style={styles.centered}>
          {description}
        </Text>
      ) : null}
      {onRetry ? (
        <Button
          label="Try again"
          icon="refresh"
          onPress={onRetry}
          loading={retrying}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centered: { textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: 8 },
});
