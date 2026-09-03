import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';

interface ScreenProps {
  children: ReactNode;
  scrollable?: boolean;
  /** Set when the screen is inside a navigator that already draws the top inset. */
  ignoreTopInset?: boolean;
}

/**
 * Applies safe-area padding and the theme background in one place, so no screen
 * has to remember either and none of them disagree about spacing.
 */
export function Screen({ children, scrollable = false, ignoreTopInset = false }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const padding = {
    paddingTop: ignoreTopInset ? 0 : insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.flex, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={[styles.content, padding]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      style={[styles.flex, styles.content, padding, { backgroundColor: theme.colors.background }]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 16 },
});
