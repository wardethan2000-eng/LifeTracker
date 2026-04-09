import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getHouseholdActivity } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";
import { ActivityFeedItem } from "../../../components/ActivityFeedItem";
import type { ActivityLog } from "../../../lib/api";

export default function ProjectActivityScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["project-activity", id, householdId],
    queryFn: () => getHouseholdActivity(householdId, { limit: 50, entityType: "project", entityId: id }),
    enabled: !!householdId && !!id,
  });

  const entries = data?.entries ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
          Project
        </Button>
        <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
          Activity
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item: ActivityLog) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="No activity yet"
              body="Activity for this project will appear here."
            />
          }
          renderItem={({ item }: { item: ActivityLog }) => (
            <ActivityFeedItem entry={item} />
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
});
