import { StyleSheet, View, FlatList, RefreshControl } from "react-native";
import { Button, Card, Divider, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getHouseholdSpacesTree } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonCard } from "../../../components/SkeletonCard";
import type { SpaceResponse } from "../../../lib/api";

function flattenSpaces(
  spaces: SpaceResponse[],
  depth = 0
): { space: SpaceResponse; depth: number }[] {
  const result: { space: SpaceResponse; depth: number }[] = [];
  for (const space of spaces) {
    result.push({ space, depth });
    if (space.children && space.children.length > 0) {
      result.push(...flattenSpaces(space.children, depth + 1));
    }
  }
  return result;
}

export default function SpacesScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: tree = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["spaces-tree", householdId],
    queryFn: () => getHouseholdSpacesTree(householdId),
    enabled: !!householdId,
  });

  const flat = flattenSpaces(tree as SpaceResponse[]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.topBar}>
        <Button
          icon="arrow-left"
          mode="text"
          compact
          onPress={() => router.back()}
          textColor={theme.colors.primary}
        >
          Inventory
        </Button>
      </View>
      <Text variant="titleMedium" style={{ paddingHorizontal: 16, color: theme.colors.onBackground }}>
        Spaces
      </Text>

      {isLoading ? (
        <View style={{ padding: 16 }}>{[1, 2, 3].map((n) => <SkeletonCard key={n} />)}</View>
      ) : (
        <FlatList
          data={flat}
          keyExtractor={({ space }) => space.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState icon="🗺" title="No spaces" body="Create spaces on the web to organize inventory." />
          }
          renderItem={({ item: { space, depth } }) => (
            <Card
              mode="outlined"
              style={[styles.card, { marginLeft: depth * 16 }]}
              onPress={() => router.push(`/inventory/spaces/${space.id}`)}
            >
              <Card.Content>
                <View style={styles.spaceRow}>
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="titleSmall"
                      style={{ color: theme.colors.onSurface }}
                      numberOfLines={1}
                    >
                      {space.name}
                    </Text>
                    {space.description && (
                      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {space.description}
                      </Text>
                    )}
                  </View>
                  {space.type && (
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {space.type.replace(/_/g, " ")}
                    </Text>
                  )}
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
  topBar: { paddingHorizontal: 8, paddingTop: 4 },
  list: { padding: 16, paddingTop: 8 },
  card: { marginBottom: 8 },
  spaceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
