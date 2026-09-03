import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';

import { useAuthActions } from '../../src/auth/use-auth-actions';
import { Screen } from '../../src/ui/screen';

const MIN_PASSWORD_LENGTH = 8;

export default function SignUpScreen() {
  const theme = useTheme();
  const { signUp, pending, error, clearError } = useAuthActions();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealPassword, setRevealPassword] = useState(false);
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

  return (
    <Screen scrollable>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text variant="headlineMedium">Create an account</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Your projects and focus history sync across your devices.
          </Text>
        </View>

        <TextInput
          mode="outlined"
          label="Name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            clearError();
          }}
          autoComplete="name"
          error={nameInvalid}
          disabled={pending}
        />
        <HelperText type="error" visible={nameInvalid}>
          Use at least two characters.
        </HelperText>

        <TextInput
          mode="outlined"
          label="Email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            clearError();
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          error={emailInvalid}
          disabled={pending}
        />
        <HelperText type="error" visible={emailInvalid}>
          Enter a valid email address.
        </HelperText>

        <TextInput
          mode="outlined"
          label="Password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            clearError();
          }}
          secureTextEntry={!revealPassword}
          autoCapitalize="none"
          autoComplete="new-password"
          error={passwordInvalid}
          disabled={pending}
          onSubmitEditing={submit}
          right={
            <TextInput.Icon
              icon={revealPassword ? 'eye-off' : 'eye'}
              onPress={() => setRevealPassword((visible) => !visible)}
              accessibilityLabel={revealPassword ? 'Hide password' : 'Show password'}
            />
          }
        />
        <HelperText type={passwordInvalid ? 'error' : 'info'} visible>
          At least {MIN_PASSWORD_LENGTH} characters.
        </HelperText>

        {error ? (
          <HelperText type="error" visible padding="none">
            {error.isOffline
              ? 'Could not reach the server. Check the API address on the sign-in screen.'
              : error.message}
          </HelperText>
        ) : null}

        <Button mode="contained" onPress={submit} loading={pending} disabled={pending}>
          Create account
        </Button>

        <Link href="/(auth)/sign-in" asChild>
          <Button mode="text" disabled={pending}>
            I already have an account
          </Button>
        </Link>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, marginBottom: 16 },
});
