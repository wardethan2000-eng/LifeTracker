import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Card, Chip, FAB, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getHouseholdProjects } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCard } from "../../components/SkeletonCard";
import { StatusPill } from "../../components/StatusPill";
import type { ProjectSummary } from "../../lib/api";

const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;

export default function ProjectsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: projects, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["projects", householdId, selectedStatus],
    queryFn: () =>
      getHouseholdProjects(householdId, {
        ...(selectedStatus ? { status: selectedStatus } : {}),
      }),
    enabled: !!householdId,
  });

  return (
    <View style={styles.container}>
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          Projects
        </Text>
      </View>

      <FlatList
        horizontal
        data={PROJECT_STATUSES}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.chips}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Chip
            selected={selectedStatus === item}
            onPress={() => setSelectedStatus(selectedStatus === item ? null : item)}
            compact
            style={styles.chip}
          >
            {item.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
          </Chip>
        )}
      />

      {isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((n) => <SkeletonCard key={n} lines={3} />)}
        </View>
      ) : (
        <FlatList
          data={projects ?? []}
          keyExtractor={(item: ProjectSummary) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="No projects yet"
              body="Create projects from the web dashboard."
            />
          }
          renderItem={({ item }: { item: ProjectSummary }) => (
            <Card
              mode="outlined"
              style={styles.card}
              onPress={() => router.push(`/projects/${item.id}`)}
            >
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text
                    variant="titleSmall"
                    style={{ flex: 1, color: theme.colors.onSurface }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <StatusPill status={item.status} />
                </View>
                {item.description && (
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                )}
                <View style={styles.statsRow}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.completedTaskCount}/{item.taskCount} tasks
                  </Text>
                  {(item.totalBudgeted ?? 0) > 0 && (
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      ${item.totalSpent.toFixed(0)}/${(item.totalBudgeted ?? 0).toFixed(0)} spent
                    </Text>
                  )}
                  {item.percentComplete > 0 && (
                    <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
                      {Math.round(item.percentComplete)}% complete
                    </Text>
                  )}
                </View>
              </Card.Content>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
      <FAB
        icon="plus"
        label="New project"
        style={styles.fab}
        onPress={() => router.push("/projects/new")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  fab: { position: "absolute", right: 16, bottom: 24 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  chips: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  chip: { marginRight: 4 },
  list: { padding: 16, paddingTop: 4 },
  card: { marginBottom: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 6 },
});
