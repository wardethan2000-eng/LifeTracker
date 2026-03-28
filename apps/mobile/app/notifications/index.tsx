import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Badge,
  Button,
  Card,
  Chip,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { getMe, getHouseholdNotifications, markNotificationRead } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCard } from "../../components/SkeletonCard";
import type { Notification } from "../../lib/api";

const STATUS_FILTERS = ["all", "unread", "read"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function NotificationIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    due_soon: "🔔",
    due: "⚠️",
    overdue: "🚨",
    inventory_low_stock: "📦",
    note_reminder: "📝",
    announcement: "📢",
    digest: "📋",
  };
  return <Text style={styles.notifIcon}>{icons[type] ?? "🔔"}</Text>;
}

function NotificationCard({
  notification,
  onMarkRead,
  marking,
  onNavigate,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  marking: boolean;
  onNavigate: (notification: Notification) => void;
}) {
  const theme = useTheme();
  const isUnread = !notification.readAt;

  return (
    <Card
      mode="outlined"
      style={[
        styles.card,
        isUnread && { borderColor: theme.colors.primary, borderWidth: 1.5 },
      ]}
      onPress={() => {
        onNavigate(notification);
        if (isUnread) onMarkRead(notification.id);
      }}
    >
      <Card.Content style={styles.cardContent}>
        <NotificationIcon type={notification.type} />
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text
              variant="titleSmall"
              style={[
                { flex: 1, color: theme.colors.onSurface },
                isUnread && { fontWeight: "700" },
              ]}
              numberOfLines={1}
            >
              {notification.title}
            </Text>
            {isUnread && (
              <Badge size={8} style={{ backgroundColor: theme.colors.primary, alignSelf: "center" }} />
            )}
          </View>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
            numberOfLines={2}
          >
            {notification.body}
          </Text>
          <View style={styles.cardFooter}>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {new Date(notification.scheduledFor).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {isUnread && (
              <Button
                mode="text"
                compact
                onPress={(e) => {
                  e.stopPropagation?.();
                  onMarkRead(notification.id);
                }}
                loading={marking}
                disabled={marking}
                labelStyle={{ fontSize: 11 }}
              >
                Mark read
              </Button>
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [markingId, setMarkingId] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notifications", householdId, filter],
    queryFn: () =>
      getHouseholdNotifications(householdId, { status: filter, limit: 50 }),
    enabled: !!householdId,
  });

  const { mutate: markRead } = useMutation({
    mutationFn: async (notificationId: string) => {
      setMarkingId(notificationId);
      return markNotificationRead(notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", householdId] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onSettled: () => setMarkingId(null),
  });

  const handleNavigate = (notification: Notification) => {
    const payload = notification.payload as Record<string, unknown>;
    const deepLink = typeof payload?.deepLink === "string" ? payload.deepLink : null;

    if (deepLink) {
      router.push(deepLink as `/${string}`);
      return;
    }

    // Fallback: route by notification type
    if (notification.assetId && (notification.type === "due_soon" || notification.type === "due" || notification.type === "overdue")) {
      router.push(`/assets/${notification.assetId}/schedules`);
    } else if (notification.type === "inventory_low_stock" && payload?.inventoryItemId) {
      router.push(`/inventory/${payload.inventoryItemId as string}`);
    } else if (notification.type === "note_reminder" && notification.entryId) {
      router.push(`/entries/${notification.entryId}`);
    }
  };

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <Badge
              size={20}
              style={{
                backgroundColor: theme.colors.primary,
                color: theme.colors.onPrimary,
                marginLeft: 8,
                alignSelf: "center",
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <Chip
            key={f}
            selected={filter === f}
            onPress={() => setFilter(f)}
            compact
            style={styles.chip}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Chip>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="🔔"
              title={filter === "unread" ? "No unread notifications" : "No notifications"}
              body="You're all caught up."
            />
          }
          renderItem={({ item }: { item: Notification }) => (
            <NotificationCard
              notification={item}
              onMarkRead={markRead}
              marking={markingId === item.id}
              onNavigate={handleNavigate}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { flexDirection: "row", alignItems: "center" },
  filters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
  },
  chip: { marginRight: 4 },
  list: { padding: 16, paddingTop: 4 },
  card: { marginBottom: 8 },
  cardContent: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  notifIcon: { fontSize: 22, lineHeight: 26 },
  cardBody: { flex: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
});
