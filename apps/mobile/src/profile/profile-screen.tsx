import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Dialog, Portal, Snackbar } from 'react-native-paper';

import { useServerSummary } from '../api/use-server-summary';
import { useAuthActions } from '../auth/use-auth-actions';
import { color, radius } from '../theme/tokens';
import { Button, Hairline } from '../ui/button';
import { Stepper, TextField } from '../ui/field';
import { Icon } from '../ui/icon';
import { Screen } from '../ui/screen';
import { ErrorState, LoadingState } from '../ui/states';
import { Card, Dot } from '../ui/surface';
import { Text } from '../ui/text';
import { BOUNDS, changes, draftFrom, validate } from './profile-form';
import type { DraftField, ProfileDraft } from './profile-form';
import { useProfile, useProfileMutation } from './use-profile';

/** Focus blocks move in fives; a one-minute nudge on a 25-minute block is noise. */
const FOCUS_STEP = 5;

export function ProfileScreen() {
  const router = useRouter();
  const profile = useProfile();
  const mutation = useProfileMutation();
  const server = useServerSummary();
  const { signOut } = useAuthActions();

  // Only what the user changed. Every untouched field keeps coming from the
  // server, so a background refetch can neither overwrite an edit in progress
  // nor leave the rest of the form showing yesterday's preferences.
  const [edits, setEdits] = useState<Partial<ProfileDraft>>({});
  const [renaming, setRenaming] = useState<string | null>(null);

  if (profile.isPending) return <LoadingState title="Loading your profile…" />;

  if (profile.isError) {
    return (
      <Screen bottomInset={false}>
        <ErrorState
          title="Could not load your profile"
          description={profile.error.message}
          onRetry={() => void profile.refetch()}
          retrying={profile.isFetching}
        />
        <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
      </Screen>
    );
  }

  const draft = { ...draftFrom(profile.data), ...edits };
  const errors = validate(draft);
  const pending = changes(profile.data, draft);
  const edited = Object.keys(pending).length > 0;
  const valid = Object.keys(errors).length === 0;

  const set = (field: DraftField) => (value: number) =>
    setEdits((current) => ({ ...current, [field]: `${value}` }));

  const save = async () => {
    try {
      await mutation.save(pending);
      // What was set is now what the server holds; dropping the edits lets the
      // saved profile through instead of shadowing it with equal numbers.
      setEdits({});
    } catch {
      // Reported by the snackbar; the edits are kept so they can be sent again.
    }
  };

  const rename = async () => {
    const name = (renaming ?? '').trim();

    if (!name || name === profile.data.name) {
      setRenaming(null);
      return;
    }

    try {
      await mutation.save({ name });
      setRenaming(null);
    } catch {
      // The dialog stays open holding what was typed, so a name rejected by
      // the server — or lost to a dropped connection — can be sent again
      // rather than retyped.
    }
  };

  return (
    <>
      <Screen scrollable bottomInset={false}>
        <Pressable
          onPress={() => setRenaming(profile.data.name)}
          accessibilityRole="button"
          accessibilityLabel="Edit your name"
          style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
        >
          <View style={styles.avatar}>
            <Text variant="numeral" tone="accent">
              {initials(profile.data.name)}
            </Text>
          </View>
          <View style={styles.names}>
            <Text variant="personName" numberOfLines={1}>
              {profile.data.name}
            </Text>
            <Text variant="label" tone="secondary" numberOfLines={1}>
              {profile.data.email}
            </Text>
          </View>
        </Pressable>

        <Text variant="overline" style={styles.section}>
          TIMER DEFAULTS
        </Text>

        <Card style={styles.card}>
          <Stepper
            label="Focus"
            value={Number(draft.focusMinutes)}
            display={`${draft.focusMinutes} min`}
            min={BOUNDS.minutes.min}
            max={BOUNDS.minutes.max}
            step={FOCUS_STEP}
            onChange={set('focusMinutes')}
          />
          <Hairline />
          <Stepper
            label="Short break"
            value={Number(draft.shortBreakMinutes)}
            display={`${draft.shortBreakMinutes} min`}
            min={BOUNDS.minutes.min}
            max={BOUNDS.minutes.max}
            onChange={set('shortBreakMinutes')}
          />
          <Hairline />
          <Stepper
            label="Long break"
            value={Number(draft.longBreakMinutes)}
            display={`${draft.longBreakMinutes} min`}
            min={BOUNDS.minutes.min}
            max={BOUNDS.minutes.max}
            step={FOCUS_STEP}
            onChange={set('longBreakMinutes')}
          />
          <Hairline />
          <Stepper
            label="Cycles until long break"
            value={Number(draft.cycles)}
            display={draft.cycles}
            min={BOUNDS.cycles.min}
            max={BOUNDS.cycles.max}
            onChange={set('cycles')}
          />
        </Card>

        {/* The steppers cannot produce an invalid number, so the button is the
          only gate — and it is only here at all because saving on every tap
          would send a request per press of `+`. */}
        {edited ? (
          <Button
            label="Save defaults"
            onPress={() => void save()}
            loading={mutation.pending}
            disabled={!valid}
            style={styles.save}
          />
        ) : null}

        <Text variant="overline" style={styles.section}>
          APP
        </Text>

        <Card style={styles.card}>
          <Pressable
            onPress={() => router.push('/server-settings')}
            accessibilityRole="button"
            accessibilityLabel={`Server ${server.address}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Icon name="server" size={20} />
            <View style={styles.rowBody}>
              <Text variant="bodyStrong">Server</Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {server.address}
              </Text>
            </View>
            <Dot size={6} color={server.online ? color.positive : color.inkIcon} />
            <Icon name="chevronRight" size={20} />
          </Pressable>
        </Card>

        <View style={styles.spacer} />

        <Button label="Sign out" variant="tonal" onPress={() => void signOut()} />
        <Text variant="caption" tone="secondary" style={styles.footnote}>
          Signing out ends this device only; other devices stay signed in.
        </Text>

        <Portal>
          <Dialog
            visible={renaming !== null}
            onDismiss={() => setRenaming(null)}
            style={styles.dialog}
          >
            <View style={styles.dialogBody}>
              <Text variant="personName">Your name</Text>
              <TextField
                label="Name"
                value={renaming ?? ''}
                onChangeText={setRenaming}
                autoCapitalize="words"
                autoFocus
                maxLength={BOUNDS.nameLength.max}
                error={
                  (renaming ?? '').trim().length < BOUNDS.nameLength.min
                    ? `At least ${BOUNDS.nameLength.min} characters.`
                    : undefined
                }
              />
              <View style={styles.dialogActions}>
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => setRenaming(null)}
                  style={styles.dialogAction}
                />
                <Button
                  label="Save"
                  onPress={() => void rename()}
                  disabled={(renaming ?? '').trim().length < BOUNDS.nameLength.min}
                  loading={mutation.pending}
                  style={styles.dialogAction}
                />
              </View>
            </View>
          </Dialog>
        </Portal>
      </Screen>

      <Snackbar
        visible={mutation.error !== null || mutation.saved}
        onDismiss={mutation.reset}
        action={{ label: 'Dismiss', onPress: mutation.reset }}
      >
        {mutation.error ? mutation.error.message : 'Preferences saved.'}
      </Snackbar>
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return '?';

  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: color.accentContainer,
    borderWidth: 1,
    borderColor: color.accentContainerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  names: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
  section: { marginTop: 28, marginBottom: 12 },
  card: { paddingHorizontal: 16 },
  save: { marginTop: 16 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBody: { flex: 1 },
  spacer: { flex: 1, minHeight: 24 },
  footnote: { marginTop: 12, textAlign: 'center' },
  dialog: { backgroundColor: color.surface, borderRadius: radius.card },
  dialogBody: { padding: 20, gap: 20 },
  dialogActions: { flexDirection: 'row', gap: 12 },
  dialogAction: { flex: 1 },
});
