import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ActivityIndicator, Button, Card, Text, useTheme } from "react-native-paper";
import type { DueWorkItem } from "../lib/api";

interface DueWorkCardProps {
  item: DueWorkItem;
  onComplete: (item: DueWorkItem) => void;
  completing?: boolean;
}

export function DueWorkCard({ item, onComplete, completing }: DueWorkCardProps) {
  const theme = useTheme();
  const isOverdue = item.status === "overdue";

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.info}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isOverdue ? theme.colors.error : theme.colors.primary },
              ]}
            />
            <Text
              variant="labelSmall"
              style={{
                color: isOverdue ? theme.colors.error : theme.colors.primary,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {isOverdue ? "Overdue" : "Due"}
            </Text>
          </View>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurface }} numberOfLines={1}>
            {item.scheduleName}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
            numberOfLines={1}
          >
            {item.assetName}
          </Text>
          {item.summary ? (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
              numberOfLines={2}
            >
              {item.summary}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={() => onComplete(item)}
          disabled={completing}
          style={[
            styles.completeBtn,
            { backgroundColor: theme.colors.primaryContainer, borderRadius: 20 },
          ]}
        >
          {completing ? (
            <ActivityIndicator size={16} color={theme.colors.primary} />
          ) : (
            <Text style={{ fontSize: 18 }}>✓</Text>
          )}
        </TouchableOpacity>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 8 },
  content: { flexDirection: "row", alignItems: "center", gap: 12 },
  info: { flex: 1, gap: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  completeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
