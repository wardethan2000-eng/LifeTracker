import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Card, Chip, FAB, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getHouseholdAssets } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCard } from "../../components/SkeletonCard";
import type { Asset } from "../../lib/api";

const CATEGORIES = [
  "vehicle", "home", "marine", "aircraft", "yard",
  "workshop", "appliance", "hvac", "technology", "other",
] as const;

export default function AssetsIndexScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["assets", householdId, selectedCategory],
    queryFn: () =>
      getHouseholdAssets(householdId, {
        limit: 100,
        ...(selectedCategory ? { category: selectedCategory } : {}),
      }),
    enabled: !!householdId,
  });

  const assets = data?.items ?? [];

  return (
    <View style={styles.container}>
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          Assets
        </Text>
      </View>

      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.chips}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Chip
            selected={selectedCategory === item}
            onPress={() => setSelectedCategory(selectedCategory === item ? null : item)}
            style={styles.chip}
            compact
          >
            {item.charAt(0).toUpperCase() + item.slice(1).replace(/_/g, " ")}
          </Chip>
        )}
      />

      {isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(item: Asset) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="🔧"
              title="No assets yet"
              body="Add your first asset from the web dashboard."
            />
          }
          renderItem={({ item }: { item: Asset }) => (
            <Card
              mode="outlined"
              style={styles.card}
              onPress={() => router.push(`/assets/${item.id}`)}
            >
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardMain}>
                  <Text
                    variant="titleSmall"
                    style={{ color: theme.colors.onSurface }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {item.category}
                    {item.manufacturer ? ` · ${item.manufacturer}` : ""}
                    {item.model ? ` ${item.model}` : ""}
                  </Text>
                </View>
                {item.isArchived && (
                  <View style={[styles.archivedBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      Archived
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
      <FAB
        icon="plus"
        label="New asset"
        style={styles.fab}
        onPress={() => router.push("/assets/new")}
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
  cardContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardMain: { flex: 1 },
  archivedBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
});
