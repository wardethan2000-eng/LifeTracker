import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import type { Entry } from "../lib/api";

const FLAG_ICONS: Record<string, string> = {
  important: "⭐",
  actionable: "✅",
  tip: "💡",
  warning: "⚠️",
  pinned: "📌",
  resolved: "✔️",
};

const ENTRY_TYPE_ICONS: Record<string, string> = {
  note: "📝",
  observation: "🔍",
  measurement: "📏",
  lesson: "💡",
  decision: "⚖️",
  issue: "⚠️",
  milestone: "🎯",
  reference: "📎",
  comparison: "↔️",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface EntryCardProps {
  entry: Entry;
}

export function EntryCard({ entry }: EntryCardProps) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      <View style={styles.header}>
        <Text style={styles.typeIcon}>{ENTRY_TYPE_ICONS[entry.entryType] ?? "📝"}</Text>
        <View style={styles.meta}>
          {entry.title ? (
            <Text variant="labelMedium" style={{ color: theme.colors.onSurface }} numberOfLines={1}>
              {entry.title}
            </Text>
          ) : null}
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {entry.resolvedEntity.label} · {relativeTime(entry.entryDate)}
          </Text>
        </View>
        {entry.flags.length > 0 && (
          <Text style={styles.flagRow}>
            {entry.flags.slice(0, 2).map((f) => FLAG_ICONS[f] ?? "").join(" ")}
          </Text>
        )}
      </View>
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurface, marginTop: 4 }}
        numberOfLines={3}
      >
        {entry.body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  typeIcon: { fontSize: 18, marginTop: 1 },
  meta: { flex: 1 },
  flagRow: { fontSize: 14, marginTop: 1 },
});
