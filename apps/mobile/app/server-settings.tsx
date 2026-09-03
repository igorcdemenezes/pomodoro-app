import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Button, Card, HelperText, Text, TextInput, useTheme } from 'react-native-paper';

import { healthQueryKey, useHealth } from '../src/api/health';
import {
  getApiBaseUrl,
  isValidBaseUrl,
  normaliseBaseUrl,
  resetApiBaseUrl,
  setApiBaseUrl,
} from '../src/config/api-config';
import { Screen } from '../src/ui/screen';
import { ErrorState, LoadingState } from '../src/ui/states';

/**
 * Where the build is pointed at a backend.
 *
 * Reachable while signed out, because it is the screen someone needs *before*
 * they can sign in: without hosting in scope, the delivered build has to work
 * against whatever machine is running the API.
 */
export default function ServerSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const client = useQueryClient();
  const health = useHealth();

  const [baseUrl, setBaseUrl] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getApiBaseUrl().then((url) => {
      setBaseUrl(url);
      setDraft(url);
    });
  }, []);

  const apply = useCallback(async () => {
    setSaving(true);
    try {
      const normalised = normaliseBaseUrl(draft);
      await setApiBaseUrl(normalised);
      setBaseUrl(normalised);
      setDraft(normalised);
      // Every cached response belongs to the previous backend.
      client.clear();
      await client.invalidateQueries({ queryKey: healthQueryKey });
    } finally {
      setSaving(false);
    }
  }, [client, draft]);

  const restore = useCallback(async () => {
    await resetApiBaseUrl();
    const restored = await getApiBaseUrl();
    setBaseUrl(restored);
    setDraft(restored);
    client.clear();
    await client.invalidateQueries({ queryKey: healthQueryKey });
  }, [client]);

  const dirty = normaliseBaseUrl(draft) !== baseUrl;
  const valid = isValidBaseUrl(draft);

  return (
    <Screen scrollable>
      <Text variant="headlineSmall">Server</Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        Point this build at the backend you are running.
      </Text>

      <Card mode="outlined">
        <Card.Title title="Connection" subtitle={baseUrl || '—'} />
        <Card.Content style={styles.status}>
          {health.isPending ? (
            <LoadingState title="Contacting the server…" />
          ) : health.isError ? (
            <ErrorState
              title="Cannot reach the API"
              description={
                'Check that the backend is running and reachable from this device. On a ' +
                'physical device use the host machine address on your network, not localhost.'
              }
              onRetry={() => void health.refetch()}
              retrying={health.isFetching}
            />
          ) : (
            <View style={styles.ok}>
              <Text variant="titleMedium" style={{ color: theme.colors.secondary }}>
                Connected
              </Text>
              <Text variant="bodySmall">
                Database {health.data.database} · up for {health.data.uptimeSeconds}s
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      <TextInput
        mode="outlined"
        label="API base URL"
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="http://192.168.0.10:3000/api/v1"
      />
      <HelperText type={valid ? 'info' : 'error'} visible>
        {valid
          ? 'An Android emulator reaches the host machine at 10.0.2.2.'
          : 'Enter a valid http or https address.'}
      </HelperText>

      <View style={styles.actions}>
        <Button mode="text" onPress={() => void restore()} disabled={saving}>
          Reset
        </Button>
        <Button
          mode="contained"
          onPress={() => void apply()}
          disabled={!dirty || !valid || saving}
          loading={saving}
        >
          Save and retry
        </Button>
      </View>

      <Button mode="text" onPress={() => router.back()}>
        Close
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { minHeight: 150 },
  ok: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 28 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
