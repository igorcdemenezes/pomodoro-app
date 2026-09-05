import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Button, Card, Text, useTheme } from 'react-native-paper';

import { authenticatedRequest } from '../../src/api/authenticated-request';
import { useAuthStore } from '../../src/auth/auth-store';
import type { UserProfile } from '../../src/auth/auth-types';
import { useAuthActions } from '../../src/auth/use-auth-actions';
import { Screen } from '../../src/ui/screen';
import { ErrorState, LoadingState } from '../../src/ui/states';

/**
 * Placeholder home.
 *
 * It fetches the profile through the authenticated client on purpose: that is
 * what exercises the token being attached, the access token expiring, and the
 * refresh rotating without the user noticing.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const setUser = useAuthStore((state) => state.setUser);
  const { signOut } = useAuthActions();

  const profile = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const user = await authenticatedRequest<UserProfile>('/me');
      setUser(user);
      return user;
    },
  });

  if (profile.isPending) return <LoadingState title="Loading your profile…" />;

  if (profile.isError) {
    return (
      <Screen>
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

  return (
    <Screen scrollable>
      <Text variant="headlineMedium">Hello, {profile.data.name}</Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {profile.data.email}
      </Text>

      <Card mode="outlined">
        <Card.Title title="Your defaults" />
        <Card.Content style={styles.rows}>
          <Row label="Focus" value={`${profile.data.focusDurationSec / 60} min`} />
          <Row label="Short break" value={`${profile.data.shortBreakSec / 60} min`} />
          <Row label="Long break" value={`${profile.data.longBreakSec / 60} min`} />
          <Row label="Cycles until long break" value={`${profile.data.cyclesUntilLongBreak}`} />
        </Card.Content>
      </Card>

      <Link href="/(app)/focus" asChild>
        <Button mode="contained" icon="play">
          Start a session
        </Button>
      </Link>

      <Link href="/(app)/projects" asChild>
        <Button mode="contained-tonal" icon="folder-outline">
          Projects
        </Button>
      </Link>

      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        History and statistics land here next.
      </Text>

      <Link href="/server-settings" asChild>
        <Button mode="text">Server</Button>
      </Link>
      <Button mode="outlined" onPress={() => void signOut()}>
        Sign out
      </Button>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium">{label}</Text>
      <Text variant="bodyMedium">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
