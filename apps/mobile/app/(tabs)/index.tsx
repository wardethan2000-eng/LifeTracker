import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMe, getHouseholdDueWork, getHouseholdActivity, completeSchedule } from "../../lib/api";
import { OfflineBanner } from "../../components/OfflineBanner";
import { DueWorkCard } from "../../components/DueWorkCard";
import { ActivityFeedItem } from "../../components/ActivityFeedItem";
import { EmptyState } from "../../components/EmptyState";
import type { DueWorkItem, ActivityLog } from "../../lib/api";

export default function HomeScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [completingId, setCompletingId] = useState<string | null>(null);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });
  const householdId = me?.households[0]?.id ?? "";

  const { data: dueWork, isLoading: dueLoading } = useQuery({
    queryKey: ["dueWork", householdId],
    queryFn: () => getHouseholdDueWork(householdId, { limit: 10, status: "all" }),
    enabled: !!householdId,
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["activity", householdId],
    queryFn: () => getHouseholdActivity(householdId, { limit: 10 }),
    enabled: !!householdId,
  });

  const { mutate: complete } = useMutation({
    mutationFn: async (item: DueWorkItem) => {
      setCompletingId(item.scheduleId);
      await completeSchedule(item.assetId, item.scheduleId, {
        completedAt: new Date().toISOString(),
        applyLinkedParts: true,
        metadata: {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dueWork", householdId] });
      queryClient.invalidateQueries({ queryKey: ["activity", householdId] });
    },
    onSettled: () => setCompletingId(null),
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
            LifeKeeper
          </Text>
          {me?.households[0] && (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {me.households[0].name}
            </Text>
          )}
        </View>

        {(meLoading || dueLoading) && (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        )}

        {/* Due & Overdue */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
              Due & Overdue
            </Text>
            {dueWork && dueWork.length > 0 ? (
              dueWork.map((item) => (
                <DueWorkCard
                  key={item.scheduleId}
                  item={item}
                  onComplete={complete}
                  completing={completingId === item.scheduleId}
                />
              ))
            ) : !dueLoading ? (
              <EmptyState icon="✅" title="All caught up" body="No maintenance due right now." />
            ) : null}
          </Card.Content>
        </Card>

        {/* Recent Activity */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
              Recent Activity
            </Text>
            {activityLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : activity?.entries && activity.entries.length > 0 ? (
              activity.entries.map((entry: ActivityLog) => (
                <ActivityFeedItem key={entry.id} entry={entry} />
              ))
            ) : (
              <EmptyState icon="📋" title="No recent activity" />
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  header: { marginBottom: 8 },
  loader: { marginVertical: 24 },
  card: { marginBottom: 4 },
});
