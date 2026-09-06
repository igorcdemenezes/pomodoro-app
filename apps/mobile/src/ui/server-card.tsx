import { Pressable, StyleSheet, View } from 'react-native';

import { useServerSummary } from '../api/use-server-summary';
import { color, radius } from '../theme/tokens';
import { Icon } from './icon';
import { Dot } from './surface';
import { Text } from './text';

/**
 * Which backend this build is pointed at, and whether it is answering.
 *
 * On the sign-in screen because it is the difference between "wrong password"
 * and "the machine running the API is off" — a distinction the user cannot make
 * from an error message alone, and the reason the address is configurable at
 * all.
 */
export function ServerCard({ onPress }: { onPress: () => void }) {
  const { address, online, checking } = useServerSummary();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`API server ${address}, ${status(online, checking)}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Icon name="server" size={20} />
      <View style={styles.body}>
        <Text variant="overline">API SERVER</Text>
        <Text variant="bodyStrong" numberOfLines={1}>
          {address}
        </Text>
      </View>
      <View style={styles.status}>
        <Dot size={6} color={online ? color.positive : color.inkIcon} />
        <Text variant="captionStrong" tone={online ? 'positive' : 'secondary'}>
          {status(online, checking)}
        </Text>
      </View>
    </Pressable>
  );
}

function status(online: boolean, checking: boolean): string {
  if (checking) return 'Checking';

  return online ? 'Online' : 'Unreachable';
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: color.cardBorder,
    borderRadius: radius.control,
    backgroundColor: color.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: { opacity: 0.75 },
  body: { flex: 1, gap: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
