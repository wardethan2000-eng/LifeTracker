import { useState } from "react";
import { FlatList, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { ActivityIndicator, Chip, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { EmptyState } from "../../components/EmptyState";
import { EntryCard } from "../../components/EntryCard";
import { getMe, getEntries, type EntryType } from "../../lib/api";

const FILTER_TABS: { label: string; value: EntryType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Notes", value: "note" },
  { label: "Observations", value: "observation" },
  { label: "Issues", value: "issue" },
  { label: "Lessons", value: "lesson" },
  { label: "Decisions", value: "decision" },
  { label: "Milestones", value: "milestone" },
];

export default function EntriesScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<EntryType | "all">("all");

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["entries", householdId, filter],
    queryFn: () =>
      filter === "all"
        ? getEntries(householdId, { limit: 50 })
        : getEntries(householdId, { entryType: filter, limit: 50 }),
    enabled: !!householdId,
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          Notes & Entries
        </Text>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_TABS.map((t) => (
          <Chip
            key={t.value}
            selected={filter === t.value}
            onPress={() => setFilter(t.value)}
            style={styles.filterChip}
            compact
          >
            {t.label}
          </Chip>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/entries/${item.id}`)}
              activeOpacity={0.75}
            >
              <EntryCard entry={item} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="📝"
              title="No entries yet"
              body="Tap Capture to add a note, observation, or measurement."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  filterChip: {},
  loader: { marginTop: 40 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
});
