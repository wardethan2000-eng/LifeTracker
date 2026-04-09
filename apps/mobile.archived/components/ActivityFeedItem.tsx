import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import type { ActivityLog } from "@aegis/types";

function actionLabel(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface ActivityFeedItemProps {
  entry: ActivityLog;
  onPress?: () => void;
}

export function ActivityFeedItem({ entry, onPress }: ActivityFeedItemProps) {
  const theme = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.row}>
        <View
          style={[styles.dot, { backgroundColor: theme.colors.primary }]}
        />
        <View style={styles.label}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>
            {actionLabel(entry.action)}{" "}
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {entry.entityType.replace(/_/g, " ")}
            </Text>
          </Text>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {relativeTime(entry.createdAt)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  label: { flex: 1, gap: 1 },
});
