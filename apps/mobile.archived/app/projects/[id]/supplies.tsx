import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getProjectDetail } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";
import type { ProjectPhaseSummary } from "@lifekeeper/types";

export default function ProjectSuppliesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: project, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["project", householdId, id],
    queryFn: () => getProjectDetail(householdId, id),
    enabled: !!householdId && !!id,
  });

  const phases = (project?.phases ?? []).filter(
    (p: ProjectPhaseSummary) => p.supplyCount > 0
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
          Project
        </Button>
        <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
          Supplies
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={phases}
          keyExtractor={(item: ProjectPhaseSummary) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="🔧"
              title="No supplies tracked"
              body="Add supplies to project phases on the web dashboard."
            />
          }
          renderItem={({ item }: { item: ProjectPhaseSummary }) => (
            <Card
              mode="outlined"
              style={styles.card}
              onPress={() => router.push(`/projects/${id}/phases/${item.id}/supplies`)}
            >
              <Card.Content>
                <View style={styles.phaseRow}>
                  <Text variant="titleSmall" style={{ flex: 1, color: theme.colors.onSurface }}>
                    {item.name}
                  </Text>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.procuredSupplyCount}/{item.supplyCount} procured ›
                  </Text>
                </View>
                {item.procuredSupplyCount < item.supplyCount && (
                  <Text variant="labelSmall" style={{ color: theme.colors.error, marginTop: 4 }}>
                    {item.supplyCount - item.procuredSupplyCount} still needed
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
  header: { padding: 16, paddingBottom: 8 },
  backBtn: { alignSelf: "flex-start", marginLeft: -8, marginBottom: 4 },
  loader: { flex: 1 },
  list: { padding: 16, paddingTop: 4 },
  card: { marginBottom: 8 },
  phaseRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
