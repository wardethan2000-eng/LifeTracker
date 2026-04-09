import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getHobbyDetail } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";
import type { HobbyDetailInventoryLink } from "@aegis/types";

export default function HobbyInventoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: hobby, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["hobby", householdId, id],
    queryFn: () => getHobbyDetail(householdId, id),
    enabled: !!householdId && !!id,
  });

  const links = hobby?.inventoryLinks ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
          Hobby
        </Button>
        <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
          Inventory
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={links}
          keyExtractor={(item: HobbyDetailInventoryLink) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="📦"
              title="No inventory linked"
              body="Link consumables and supplies to this hobby on the web dashboard."
            />
          }
          renderItem={({ item }: { item: HobbyDetailInventoryLink }) => (
            <Card
              mode="outlined"
              style={styles.card}
              onPress={() => router.push(`/inventory/${item.inventoryItemId}` as Parameters<typeof router.push>[0])}
            >
              <Card.Content style={styles.cardContent}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                    {item.inventoryItem.name}
                  </Text>
                  {item.notes && (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {item.notes}
                    </Text>
                  )}
                </View>
                <View style={styles.qtyBadge}>
                  <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
                    {item.inventoryItem.quantityOnHand}
                  </Text>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.inventoryItem.unit}
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
