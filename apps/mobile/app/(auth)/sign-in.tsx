import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuthActions } from '../../src/auth/use-auth-actions';
import { color, radius } from '../../src/theme/tokens';
import { Button, TextButton } from '../../src/ui/button';
import { TextField } from '../../src/ui/field';
import { Icon } from '../../src/ui/icon';
import { Screen } from '../../src/ui/screen';
import { ServerCard } from '../../src/ui/server-card';
import { Text } from '../../src/ui/text';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, pending, error, clearError } = useAuthActions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  const emailInvalid = touched && !email.includes('@');
  const passwordInvalid = touched && password.length === 0;
  const canSubmit = email.includes('@') && password.length > 0 && !pending;

  const submit = () => {
    setTouched(true);
    if (canSubmit) void signIn({ email: email.trim(), password });
  };

  const change = (set: (value: string) => void) => (value: string) => {
    set(value);
    clearError();
  };

  return (
    <Screen scrollable contentStyle={styles.content}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.mark}>
          <Icon name="timer" size={26} color={color.accent} strokeWidth={1.8} />
        </View>

        <Text variant="authTitle" style={styles.title}>
          Welcome back
        </Text>
        <Text variant="body" tone="secondary" style={styles.subtitle}>
          Sign in to pick up where you left off.
        </Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={change(setEmail)}
            error={emailInvalid ? 'Enter a valid email address.' : undefined}
            keyboardType="email-address"
            autoComplete="email"
            editable={!pending}
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={change(setPassword)}
            error={passwordInvalid ? 'Enter your password.' : undefined}
            secure
            revealable
            autoComplete="current-password"
            editable={!pending}
            onSubmitEditing={submit}
          />
        </View>

        {/* A rejected sign-in is about the pair, not about either field, so it
            is reported once under both rather than twice inside them. */}
        {error ? (
          <View style={styles.failure}>
            <Icon name="alert" size={16} color={color.accent} strokeWidth={2} />
            <Text variant="label" tone="accent" style={styles.flex}>
              {error.isOffline
                ? 'Could not reach the server. Check the API address below.'
                : error.message}
            </Text>
          </View>
        ) : null}

        <Button label="Sign in" onPress={submit} loading={pending} style={styles.submit} />

        <View style={styles.switch}>
          <Text variant="label" tone="secondary">
            New here?
          </Text>
          <TextButton
            label="Create an account"
            disabled={pending}
            onPress={() => router.push('/sign-up')}
          />
        </View>

        <View style={styles.flex} />

        <ServerCard onPress={() => router.push('/server-settings')} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 40 },
  flex: { flex: 1 },
  mark: {
    width: 52,
    height: 52,
    borderRadius: radius.card,
    backgroundColor: color.accentContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: 28 },
  subtitle: { marginTop: 6 },
  form: { marginTop: 32, gap: 20 },
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
