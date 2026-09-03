import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';

import { useAuthActions } from '../../src/auth/use-auth-actions';
import { Screen } from '../../src/ui/screen';

export default function SignInScreen() {
  const theme = useTheme();
  const { signIn, pending, error, clearError } = useAuthActions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealPassword, setRevealPassword] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailInvalid = touched && !email.includes('@');
  const passwordInvalid = touched && password.length === 0;
  const canSubmit = email.includes('@') && password.length > 0 && !pending;

  const submit = () => {
    setTouched(true);
    if (canSubmit) void signIn({ email: email.trim(), password });
  };

  return (
    <Screen scrollable>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text variant="headlineMedium">Welcome back</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Sign in to pick up where you left off.
          </Text>
        </View>

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
          autoComplete="current-password"
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
        <HelperText type="error" visible={passwordInvalid}>
          Enter your password.
        </HelperText>

        {error ? (
          <HelperText type="error" visible padding="none">
            {error.isOffline
              ? 'Could not reach the server. Check the API address below.'
              : error.message}
          </HelperText>
        ) : null}

        <Button mode="contained" onPress={submit} loading={pending} disabled={pending}>
          Sign in
        </Button>

        <View style={styles.links}>
          <Link href="/(auth)/sign-up" asChild>
            <Button mode="text" disabled={pending}>
              Create an account
            </Button>
          </Link>
          <Link href="/server-settings" asChild>
            <Button mode="text" disabled={pending}>
              Server
            </Button>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, marginBottom: 16 },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
});
