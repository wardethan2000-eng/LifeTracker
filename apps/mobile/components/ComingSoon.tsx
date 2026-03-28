import { StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface ComingSoonProps {
  title: string;
  phase?: string;
}

/** Shared placeholder used by stub screens during Phase 0 */
export function ComingSoon({ title, phase = "Phase 2" }: ComingSoonProps) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
        {title}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        Full implementation coming in {phase}.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { marginBottom: 8 },
});
