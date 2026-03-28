import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getCanvases } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";
import type { IdeaCanvasSummary } from "../../../lib/api";

export default function HobbyCanvasScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: canvases = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["canvases", "hobby", id, householdId],
    queryFn: () => getCanvases(householdId, { entityType: "hobby", entityId: id }),
    enabled: !!householdId && !!id,
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
          Hobby
        </Button>
        <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
          Canvas
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={canvases}
          keyExtractor={(item: IdeaCanvasSummary) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="🗺️"
              title="No canvases yet"
              body="Create a canvas for this hobby on the web dashboard."
            />
          }
          renderItem={({ item }: { item: IdeaCanvasSummary }) => (
            <Card
              mode="outlined"
              style={styles.card}
              onPress={() => router.push(`/canvas/${item.id}` as never)}
            >
              <Card.Content style={styles.cardContent}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                    {item.name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.nodeCount} node{item.nodeCount !== 1 ? "s" : ""}
                    {item.edgeCount > 0 ? ` · ${item.edgeCount} connection${item.edgeCount !== 1 ? "s" : ""}` : ""}
                  </Text>
                </View>
                <Text style={{ color: theme.colors.primary }}>›</Text>
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
  cardContent: { flexDirection: "row", alignItems: "center" },
});
