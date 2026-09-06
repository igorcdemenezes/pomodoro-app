import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { healthQueryKey, useHealth } from '../src/api/health';
import {
  getApiBaseUrl,
  isValidBaseUrl,
  normaliseBaseUrl,
  resetApiBaseUrl,
  setApiBaseUrl,
} from '../src/config/api-config';
import { color } from '../src/theme/tokens';
import { Button } from '../src/ui/button';
import { TextField } from '../src/ui/field';
import { HeaderBar, Screen } from '../src/ui/screen';
import { ErrorState, LoadingState } from '../src/ui/states';
import { Card, Dot } from '../src/ui/surface';
import { Text } from '../src/ui/text';

/**
 * Where the build is pointed at a backend.
 *
 * Reachable while signed out, because it is the screen someone needs *before*
 * they can sign in: without hosting in scope, the delivered build has to work
 * against whatever machine is running the API.
 */
export default function ServerSettingsScreen() {
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
    <Screen scrollable header={<HeaderBar title="Server" onBack={() => router.back()} />}>
      <Text variant="body" tone="secondary">
        Point this build at the backend you are running.
      </Text>

      <Card style={styles.status}>
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
            <View style={styles.okHead}>
              <Dot size={8} color={color.positive} />
              <Text variant="sectionHeading" tone="positive">
                Connected
              </Text>
            </View>
            <Text variant="caption" tone="secondary">
              Database {health.data.database} · up for {health.data.uptimeSeconds}s
            </Text>
          </View>
        )}
      </Card>

      <View style={styles.form}>
        <TextField
          label="API base URL"
          value={draft}
          onChangeText={setDraft}
          keyboardType="url"
          placeholder="http://192.168.0.10:3000/api/v1"
          error={valid ? undefined : 'Enter a valid http or https address.'}
          hint="An Android emulator reaches the host machine at 10.0.2.2."
        />
      </View>

      <View style={styles.actions}>
        <Button label="Reset" variant="ghost" onPress={() => void restore()} disabled={saving} />
        <Button
          label="Save and retry"
          onPress={() => void apply()}
          disabled={!dirty || !valid}
          loading={saving}
          style={styles.save}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { marginTop: 20, minHeight: 170, justifyContent: 'center', padding: 16 },
  ok: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 28 },
  okHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  form: { marginTop: 20 },
  actions: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  save: { flex: 1 },
});
