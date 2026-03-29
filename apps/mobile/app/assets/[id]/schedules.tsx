import { Alert, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, getAssetDetail, completeSchedule } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";
import { StatusPill } from "../../../components/StatusPill";

export default function AssetSchedulesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["asset-detail", id],
    queryFn: () => getAssetDetail(id!),
    enabled: !!id,
  });

  const { mutate: complete, isPending: completing } = useMutation({
    mutationFn: (scheduleId: string) =>
      completeSchedule(id!, scheduleId, {
        completedAt: new Date().toISOString(),
        applyLinkedParts: true,
        metadata: {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["dueWork"] });
      if (householdId) queryClient.invalidateQueries({ queryKey: ["activity", householdId] });
    },
    onError: () => {
      Alert.alert("Error", "Could not mark schedule as done. Please try again.");
    },
  });

  const schedules = data?.schedules ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
          Asset
        </Button>
        <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
          Maintenance Schedules
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={schedules}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="📅"
              title="No schedules"
              body="Create maintenance schedules from the web dashboard."
            />
          }
          renderItem={({ item }) => (
            <Card mode="outlined" style={styles.card}>
              <Card.Content>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                      {item.name}
                    </Text>
                    {item.nextDueAt && (
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                        Due {new Date(item.nextDueAt).toLocaleDateString()}
                      </Text>
                    )}
                    {item.lastCompletedAt && (
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        Last done {new Date(item.lastCompletedAt).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.cardActions}>
                    <StatusPill status={item.status} />
                    {(item.status === "due" || item.status === "overdue") && (
                      <Button
                        mode="contained-tonal"
                        compact
                        onPress={() => complete(item.id)}
                        loading={completing}
                        disabled={completing}
                        style={{ marginTop: 8 }}
                      >
                        Done
                      </Button>
                    )}
                  </View>
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
  row: { flexDirection: "row", gap: 8 },
  cardActions: { alignItems: "flex-end" },
});
