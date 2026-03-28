import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Card, Chip, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getHouseholdHobbies } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCard } from "../../components/SkeletonCard";
import { StatusPill } from "../../components/StatusPill";
import type { HobbySummary } from "../../lib/api";

const HOBBY_STATUSES = ["active", "paused", "archived"] as const;

export default function HobbiesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["hobbies", householdId, selectedStatus],
    queryFn: () =>
      getHouseholdHobbies(householdId, { ...(selectedStatus ? { status: selectedStatus } : {}) }),
    enabled: !!householdId,
  });

  const hobbies = data?.items ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          Hobbies
        </Text>
      </View>

      <FlatList
        horizontal
        data={HOBBY_STATUSES}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.chips}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Chip
            selected={selectedStatus === item}
            onPress={() => setSelectedStatus(selectedStatus === item ? null : item)}
            compact
            style={styles.chip}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </Chip>
        )}
      />

      {isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </View>
      ) : (
        <FlatList
          data={hobbies}
          keyExtractor={(item: HobbySummary) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="🎨"
              title="No hobbies yet"
              body="Create a hobby from the web dashboard."
            />
          }
          renderItem={({ item }: { item: HobbySummary }) => (
            <Card
              mode="outlined"
              style={styles.card}
              onPress={() => router.push(`/hobbies/${item.id}`)}
            >
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text
                    variant="titleSmall"
                    style={{ flex: 1, color: theme.colors.onSurface }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <StatusPill status={item.status} />
                </View>
                {item.hobbyType && (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                    {item.hobbyType}
                  </Text>
                )}
                <View style={styles.statsRow}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.sessionCount} sessions
                  </Text>
                  {item.activeSessionCount > 0 && (
                    <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
                      {item.activeSessionCount} in progress
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
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  chips: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  chip: { marginRight: 4 },
  list: { padding: 16, paddingTop: 4 },
  card: { marginBottom: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 6 },
});
