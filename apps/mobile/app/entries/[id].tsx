import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Chip, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { getMe, getEntry, deleteEntry } from "../../lib/api";

const FLAG_ICONS: Record<string, string> = {
  important: "⭐",
  actionable: "✅",
  tip: "💡",
  warning: "⚠️",
  pinned: "📌",
  resolved: "✔️",
  archived: "🗄️",
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

export default function EntryDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: entry, isLoading } = useQuery({
    queryKey: ["entry", id],
    queryFn: () => getEntry(householdId, id),
    enabled: !!householdId && !!id,
  });

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: () => deleteEntry(householdId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      router.back();
    },
    onError: (err) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete entry.");
    },
  });

  function confirmDelete() {
    Alert.alert(
      "Delete Entry",
      "This entry will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete Entry", style: "destructive", onPress: () => remove() },
      ]
    );
  }

  if (isLoading || !entry) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  const formattedDate = new Date(entry.entryDate).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.typeIcon}>{ENTRY_TYPE_ICONS[entry.entryType] ?? "📝"}</Text>
          <View style={styles.headerText}>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, textTransform: "capitalize" }}>
              {entry.entryType} · {formattedDate}
            </Text>
            {entry.title ? (
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 2 }}>
                {entry.title}
              </Text>
            ) : null}
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {entry.resolvedEntity.label}
            </Text>
          </View>
        </View>

        {/* Body */}
        <Text variant="bodyMedium" style={[styles.body, { color: theme.colors.onSurface }]}>
          {entry.body}
        </Text>

        {/* Flags */}
        {entry.flags.length > 0 && (
          <View style={styles.flagRow}>
            {entry.flags.map((f) => (
              <Chip key={f} compact style={styles.flag}>
                {FLAG_ICONS[f] ?? ""} {f}
              </Chip>
            ))}
          </View>
        )}

        {/* Measurements */}
        {entry.measurements.length > 0 && (
          <View style={[styles.section, { borderColor: theme.colors.outlineVariant }]}>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 6 }}>
              Measurements
            </Text>
            {entry.measurements.map((m, i) => (
              <View key={i} style={styles.measureRow}>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurface, flex: 1 }}>
                  {m.name}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
                  {m.value} {m.unit}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Danger zone */}
        <View style={styles.dangerZone}>
          <Button
            mode="outlined"
            textColor={theme.colors.error}
            onPress={confirmDelete}
            loading={deleting}
            disabled={deleting}
          >
            Delete Entry
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 60 },
  scroll: { padding: 16, gap: 12 },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  typeIcon: { fontSize: 28, marginTop: 2 },
  headerText: { flex: 1, gap: 2 },
  body: { lineHeight: 22 },
  flagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flag: {},
  section: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 6 },
  measureRow: { flexDirection: "row", justifyContent: "space-between" },
  dangerZone: { marginTop: 24, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e0e0e0" },
});
