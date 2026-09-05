import { useState } from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import {
  Button,
  Divider,
  HelperText,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { useAuthActions } from '../auth/use-auth-actions';
import { Screen } from '../ui/screen';
import { ErrorState, LoadingState } from '../ui/states';
import { changes, draftFrom, validate } from './profile-form';
import type { DraftField, ProfileDraft } from './profile-form';
import { useProfile, useProfileMutation } from './use-profile';

export function ProfileScreen() {
  const theme = useTheme();
  const profile = useProfile();
  const mutation = useProfileMutation();
  const { signOut } = useAuthActions();

  // Only what the user typed. Every untouched field keeps coming from the
  // server, so a background refetch can neither overwrite an edit in progress
  // nor leave the rest of the form showing yesterday's preferences.
  const [edits, setEdits] = useState<Partial<ProfileDraft>>({});

  if (profile.isPending) return <LoadingState title="Loading your profile…" />;

  if (profile.isError) {
    return (
      <Screen ignoreTopInset>
        <ErrorState
          title="Could not load your profile"
          description={profile.error.message}
          onRetry={() => void profile.refetch()}
          retrying={profile.isFetching}
        />
        <Button mode="text" onPress={() => void signOut()}>
          Sign out
        </Button>
      </Screen>
    );
  }

  const draft = { ...draftFrom(profile.data), ...edits };
  const errors = validate(draft);
  const pending = changes(profile.data, draft);
  const edited = Object.keys(pending).length > 0;
  const valid = Object.keys(errors).length === 0;

  const set = (field: DraftField) => (value: string) =>
    setEdits((current) => ({ ...current, [field]: value }));

  const submit = async () => {
    try {
      await mutation.save(pending);
      // What was typed is now what the server holds; dropping the edits lets
      // the saved profile through instead of shadowing it with equal text.
      setEdits({});
    } catch {
      // Reported by the snackbar; the edits are kept so they can be sent again.
    }
  };

  return (
    <Screen scrollable ignoreTopInset>
      <View>
        <Text variant="headlineSmall">{profile.data.name}</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {profile.data.email}
        </Text>
      </View>

      <Field
        label="Name"
        value={draft.name}
        error={errors.name}
        onChangeText={set('name')}
        autoCapitalize="words"
      />

      <Divider />

      <Text variant="titleMedium">Session defaults</Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        What a new session is worth when you start one. Sessions already recorded keep the length
        they ran for.
      </Text>

      <Field
        label="Focus (minutes)"
        value={draft.focusMinutes}
        error={errors.focusMinutes}
        onChangeText={set('focusMinutes')}
        keyboardType="number-pad"
      />
      <Field
        label="Short break (minutes)"
        value={draft.shortBreakMinutes}
        error={errors.shortBreakMinutes}
        onChangeText={set('shortBreakMinutes')}
        keyboardType="number-pad"
      />
      <Field
        label="Long break (minutes)"
        value={draft.longBreakMinutes}
        error={errors.longBreakMinutes}
        onChangeText={set('longBreakMinutes')}
        keyboardType="number-pad"
      />
      <Field
        label="Sessions until a long break"
        value={draft.cycles}
        error={errors.cycles}
        onChangeText={set('cycles')}
        keyboardType="number-pad"
      />

      <Button
        mode="contained"
        icon="content-save-outline"
        loading={mutation.pending}
        disabled={!edited || !valid || mutation.pending}
        onPress={() => void submit()}
      >
        Save changes
      </Button>

      <Divider />

      <Link href="/server-settings" asChild>
        <Button mode="text" icon="server">
          Server address
        </Button>
      </Link>
      <Button mode="outlined" icon="logout" onPress={() => void signOut()}>
        Sign out
      </Button>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Signing out ends this device only; other devices stay signed in.
      </Text>

      <Snackbar
        visible={mutation.error !== null || mutation.saved}
        onDismiss={mutation.reset}
        action={{ label: 'Dismiss', onPress: mutation.reset }}
      >
        {mutation.error ? mutation.error.message : 'Preferences saved.'}
      </Snackbar>
    </Screen>
  );
}

interface FieldProps {
  label: string;
  value: string;
  error?: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'number-pad';
  autoCapitalize?: 'words';
}

function Field({ label, value, error, onChangeText, keyboardType, autoCapitalize }: FieldProps) {
  return (
    <View>
      <TextInput
        mode="outlined"
        label={label}
        // Paper does not derive one from the label.
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        error={error !== undefined}
      />
      <HelperText type="error" visible={error !== undefined}>
        {error ?? ''}
      </HelperText>
    </View>
  );
}
