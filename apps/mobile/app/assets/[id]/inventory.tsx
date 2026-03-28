import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getAssetDetail } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";

export default function AssetInventoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["asset-detail", id],
    queryFn: () => getAssetDetail(id!),
    enabled: !!id,
  });

  const inventoryLinks = data?.inventoryLinks ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
          Asset
        </Button>
        <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
          Linked Inventory
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={inventoryLinks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="📦"
              title="No inventory linked"
              body="Link parts and consumables from the web dashboard."
            />
          }
          renderItem={({ item }) => (
            <Card mode="outlined" style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                    {item.inventoryItem.name ?? item.inventoryItemId}
                  </Text>
                  {item.notes && (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {item.notes}
                    </Text>
                  )}
                </View>
                <View style={styles.qtyBadge}>
                  <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
                    {item.recommendedQuantity ?? "—"}
                  </Text>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    required
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
  header: { padding: 16, paddingBottom: 8 },
  backBtn: { alignSelf: "flex-start", marginLeft: -8, marginBottom: 4 },
  loader: { flex: 1 },
  list: { padding: 16, paddingTop: 4 },
  card: { marginBottom: 8 },
  cardContent: { flexDirection: "row", alignItems: "center" },
  qtyBadge: { alignItems: "center" },
});
