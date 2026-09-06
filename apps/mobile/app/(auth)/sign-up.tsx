import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { useAuthActions } from '../../src/auth/use-auth-actions';
import { useGoBack } from '../../src/navigation/use-go-back';
import { color } from '../../src/theme/tokens';
import { Button, TextButton } from '../../src/ui/button';
import { TextField } from '../../src/ui/field';
import { Icon } from '../../src/ui/icon';
import { HeaderBar, Screen } from '../../src/ui/screen';
import { Text } from '../../src/ui/text';

const MIN_PASSWORD_LENGTH = 8;

export default function SignUpScreen() {
  const { signUp, pending, error, clearError } = useAuthActions();
  // Sign-in is where this screen is opened from, and where both ways out of it
  // go when it was opened from nowhere.
  const goBack = useGoBack('/(auth)/sign-in');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  // The same bounds the API enforces, checked here so a mistake is caught
  // before a round trip. The server remains the authority.
  const nameInvalid = touched && name.trim().length < 2;
  const emailInvalid = touched && !email.includes('@');
  const passwordInvalid = touched && password.length < MIN_PASSWORD_LENGTH;
  const canSubmit =
    name.trim().length >= 2 &&
    email.includes('@') &&
    password.length >= MIN_PASSWORD_LENGTH &&
    !pending;

  const submit = () => {
    setTouched(true);
    if (canSubmit) void signUp({ name: name.trim(), email: email.trim(), password });
  };

  const change = (set: (value: string) => void) => (value: string) => {
    set(value);
    clearError();
  };

  // An address the server has already seen is a fact about the email field, so
  // it is reported on the field rather than as a note under the button.
  const takenEmail = error?.code === 'EMAIL_ALREADY_REGISTERED';

  return (
    <Screen scrollable header={<HeaderBar onBack={goBack} />} contentStyle={styles.content}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Text variant="authTitle">Create an account</Text>
        <Text variant="body" tone="secondary" style={styles.subtitle}>
          Your projects and focus history sync across your devices.
        </Text>

        <View style={styles.form}>
          <TextField
            label="Name"
            value={name}
            onChangeText={change(setName)}
            error={nameInvalid ? 'Use at least two characters.' : undefined}
            autoCapitalize="words"
            autoComplete="name"
            editable={!pending}
          />
          <TextField
            label="Email"
            value={email}
            onChangeText={change(setEmail)}
            error={
              emailInvalid
                ? 'Enter a valid email address.'
                : takenEmail
                  ? 'An account with this email already exists.'
                  : undefined
            }
            keyboardType="email-address"
            autoComplete="email"
            editable={!pending}
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={change(setPassword)}
            error={passwordInvalid ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            secure
            revealable
            autoComplete="new-password"
            editable={!pending}
            onSubmitEditing={submit}
          />
        </View>

        {error && !takenEmail ? (
          <View style={styles.failure}>
            <Icon name="alert" size={16} color={color.accent} strokeWidth={2} />
            <Text variant="label" tone="accent" style={styles.flex}>
              {error.isOffline
                ? 'Could not reach the server. Check the API address on the sign-in screen.'
                : error.message}
            </Text>
          </View>
        ) : null}

        <Button label="Create account" onPress={submit} loading={pending} style={styles.submit} />

        <View style={styles.switch}>
          <Text variant="label" tone="secondary">
            Already registered?
          </Text>
          <TextButton label="Sign in" disabled={pending} onPress={goBack} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8 },
  flex: { flex: 1 },
  subtitle: { marginTop: 6 },
  form: { marginTop: 28, gap: 18 },
  failure: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16 },
  submit: { marginTop: 28 },
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
});
