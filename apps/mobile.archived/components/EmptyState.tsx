import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface EmptyStateProps {
  icon?: string;
  title: string;
  body?: string;
}

export function EmptyState({ icon = "📭", title, body }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
        {title}
      </Text>
      {body ? (
        <Text variant="bodySmall" style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
          {body}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 },
  icon: { fontSize: 40, marginBottom: 12 },
  title: { textAlign: "center", marginBottom: 6 },
  body: { textAlign: "center", lineHeight: 20 },
});
