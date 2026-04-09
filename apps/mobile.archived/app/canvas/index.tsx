/**
 * Canvas list screen for an entity (asset, project, hobby, idea).
 * Shows all canvases linked to the entity, with tap-to-view.
 */
import { FlatList, StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getCanvases } from "../../lib/api";
import type { IdeaCanvasSummary } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";

const MODE_ICON: Record<string, string> = {
  diagram: "🗺️",
  floorplan: "📐",
  freehand: "✏️",
};

type Params = {
  entityType: string;
  entityId: string;
  title?: string;
};

export default function CanvasListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { entityType, entityId, title } = useLocalSearchParams<Params>();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: canvases, isLoading } = useQuery({
    queryKey: ["canvases", householdId, entityType, entityId],
    queryFn: () =>
      getCanvases(householdId, {
        entityType: entityType ?? undefined,
        entityId: entityId ?? undefined,
      }),
    enabled: !!householdId,
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          {title ?? "Canvases"}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={canvases ?? []}
          keyExtractor={(item: IdeaCanvasSummary) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="🗺️"
              title="No canvases"
              body="Canvases are created on the web dashboard."
            />
          }
          renderItem={({ item }: { item: IdeaCanvasSummary }) => (
            <Card
              mode="outlined"
              style={styles.card}
              onPress={() =>
                router.push(
                  `/canvas/${item.id}?householdId=${householdId}&name=${encodeURIComponent(item.name)}`
                )
              }
            >
              <Card.Content style={styles.cardContent}>
                <Text style={styles.modeIcon}>
                  {MODE_ICON[item.canvasMode] ?? "🗺️"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    variant="titleSmall"
                    style={{ color: theme.colors.onSurface }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
                  >
                    {item.nodeCount} nodes · {item.edgeCount} edges ·{" "}
                    {item.canvasMode}
                  </Text>
                </View>
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
  list: { padding: 16, paddingTop: 4 },
  card: { marginBottom: 8 },
  cardContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  modeIcon: { fontSize: 24 },
});
