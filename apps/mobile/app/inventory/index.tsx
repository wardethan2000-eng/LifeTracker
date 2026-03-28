import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Card, Chip, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getHouseholdInventory } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCard } from "../../components/SkeletonCard";

export default function InventoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["inventory", householdId, lowStockOnly],
    queryFn: () =>
      getHouseholdInventory(householdId, { ...(lowStockOnly ? { lowStock: true } : {}) }),
    enabled: !!householdId,
  });

  const items = data?.items ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          Inventory
        </Text>
      </View>

      <View style={styles.filters}>
        <Chip
          selected={lowStockOnly}
          onPress={() => setLowStockOnly((v) => !v)}
          compact
          {...(lowStockOnly ? { icon: "check" } : {})}
        >
          Low stock only
        </Chip>
        <Chip
          onPress={() => router.push("/inventory/spaces")}
          compact
          icon="map-marker-outline"
        >
          Spaces
        </Chip>
      </View>

      {isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="📦"
              title={lowStockOnly ? "No low-stock items" : "No inventory items"}
              body={lowStockOnly ? "All stocked up." : "Add consumables and parts to track usage."}
            />
          }
          renderItem={({ item }: { item: any }) => (
            <Card
              mode="outlined"
              style={styles.card}
              onPress={() => router.push(`/inventory/${item.id}`)}
            >
              <Card.Content style={styles.cardContent}>
                <View style={{ flex: 1 }}>
                  <Text
                    variant="titleSmall"
                    style={{ color: theme.colors.onSurface }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {item.category && (
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                      {item.category.replace(/_/g, " ")}
                    </Text>
                  )}
                </View>
                <View style={styles.qtyBlock}>
                  <Text
                    variant="headlineMedium"
                    style={{
                      color: item.lowStock ? theme.colors.error : theme.colors.primary,
                      lineHeight: 32,
                    }}
                  >
                    {item.quantity}
                  </Text>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.unit ?? "units"}
                  </Text>
                </View>
              </Card.Content>
              {item.lowStock && (
                <View style={[styles.lowStockBar, { backgroundColor: theme.colors.errorContainer }]}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onErrorContainer }}>
                    LOW STOCK
                  </Text>
                </View>
              )}
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
  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexWrap: "wrap",
  },
  list: { padding: 16, paddingTop: 4 },
  card: { marginBottom: 8, overflow: "hidden" },
  cardContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  qtyBlock: { alignItems: "center" },
  lowStockBar: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: "center",
  },
});
