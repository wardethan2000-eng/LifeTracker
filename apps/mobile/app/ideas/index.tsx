import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Button, Card, Chip, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getHouseholdIdeas } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCard } from "../../components/SkeletonCard";
import { StatusPill } from "../../components/StatusPill";
import type { IdeaSummary } from "../../lib/api";

const IDEA_STAGES = ["spark", "developing", "ready"] as const;

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Med",
  high: "High",
};

export default function IdeasScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["ideas", householdId, selectedStage],
    queryFn: () =>
      getHouseholdIdeas(householdId, { ...(selectedStage ? { stage: selectedStage } : {}) }),
    enabled: !!householdId,
  });

  const ideas = data ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          Ideas
        </Text>
      </View>

      <FlatList
        horizontal
        data={IDEA_STAGES}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.chips}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Chip
            selected={selectedStage === item}
            onPress={() => setSelectedStage(selectedStage === item ? null : item)}
            compact
            style={styles.chip}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </Chip>
        )}
      />

      {isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </View>
      ) : (
        <FlatList
          data={ideas}
          keyExtractor={(item: IdeaSummary) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="💡"
              title="No ideas yet"
              body="Capture your ideas before they slip away."
            />
          }
          renderItem={({ item }: { item: IdeaSummary }) => (
            <Card
              mode="outlined"
              style={[styles.card, !!item.archivedAt && { opacity: 0.6 }]}
              onPress={() => router.push(`/ideas/${item.id}`)}
            >
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text
                    variant="titleSmall"
                    style={{ flex: 1, color: theme.colors.onSurface }}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <StatusPill status={item.archivedAt ? "archived" : item.stage} />
                </View>
                <View style={styles.metaRow}>
                  {item.category && (
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {item.category.replace(/_/g, " ")}
                    </Text>
                  )}
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Priority: {PRIORITY_LABELS[item.priority] ?? item.priority}
                  </Text>
                  {item.noteCount > 0 && (
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {item.noteCount} notes
                    </Text>
                  )}
                </View>
                {item.promotionTarget && (
                  <Text variant="labelSmall" style={{ color: theme.colors.primary, marginTop: 4 }}>
                    → {item.promotionTarget}
                  </Text>
                )}
              </Card.Content>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  chips: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  chip: { marginRight: 4 },
  list: { padding: 16, paddingTop: 4 },
  card: { marginBottom: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaRow: { flexDirection: "row", gap: 12, marginTop: 6, flexWrap: "wrap" },
});
