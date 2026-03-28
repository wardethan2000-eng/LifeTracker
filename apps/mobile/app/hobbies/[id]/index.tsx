import { StyleSheet, View, ScrollView } from "react-native";
import { Card, Text, Button, useTheme, Divider } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getHobbyDetail } from "../../../lib/api";
import { StatusPill } from "../../../components/StatusPill";
import { SkeletonCard } from "../../../components/SkeletonCard";

const SUB_SCREENS = [
  { route: "sessions", label: "Sessions", icon: "▶" },
  { route: "notes", label: "Notes", icon: "📝" },
] as const;

export default function HobbyDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: hobby, isLoading } = useQuery({
    queryKey: ["hobby", householdId, id],
    queryFn: () => getHobbyDetail(householdId, id),
    enabled: !!householdId && !!id,
  });

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
          Hobbies
        </Button>
      </View>

      {isLoading || !hobby ? (
        <View style={{ padding: 16 }}>
          <SkeletonCard lines={4} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Hero */}
          <View style={styles.hero}>
            <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
              {hobby.name}
            </Text>
            <View style={styles.heroMeta}>
              <StatusPill status={hobby.status} />
              {hobby.hobbyType && (
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {hobby.hobbyType.replace(/_/g, " ")}
                </Text>
              )}
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {hobby.activityMode} mode
              </Text>
            </View>
            {hobby.description && (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
              >
                {hobby.description}
              </Text>
            )}
          </View>

          {/* Stats */}
          <Card mode="outlined" style={styles.statsCard}>
            <Card.Content style={styles.statsRow}>
              <View style={styles.stat}>
                <Text variant="headlineSmall" style={{ color: theme.colors.primary }}>
                  {hobby.sessionCount}
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Sessions
                </Text>
              </View>
              <View style={styles.stat}>
                <Text variant="headlineSmall" style={{ color: theme.colors.primary }}>
                  {hobby.recipeCount}
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Recipes
                </Text>
              </View>
              <View style={styles.stat}>
                <Text variant="headlineSmall" style={{ color: theme.colors.primary }}>
                  {hobby.assetLinks?.length ?? 0}
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Assets
                </Text>
              </View>
              <View style={styles.stat}>
                <Text variant="headlineSmall" style={{ color: theme.colors.primary }}>
                  {hobby.inventoryLinks?.length ?? 0}
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Supplies
                </Text>
              </View>
            </Card.Content>
          </Card>

          {/* Recent Sessions */}
          {hobby.recentSessions && hobby.recentSessions.length > 0 && (
            <Card mode="outlined" style={styles.card}>
              <Card.Title title="Recent Sessions" titleVariant="titleSmall" />
              <Card.Content>
                {hobby.recentSessions.map((s, idx) => (
                  <View key={s.id}>
                    {idx > 0 && <Divider style={{ marginVertical: 8 }} />}
                    <View style={styles.sessionRow}>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                          {s.name}
                        </Text>
                        {s.recipeName && (
                          <Text
                            variant="labelSmall"
                            style={{ color: theme.colors.onSurfaceVariant }}
                          >
                            {s.recipeName}
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <StatusPill status={s.status} />
                        <Text
                          variant="labelSmall"
                          style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
                        >
                          {new Date(s.startDate ?? Date.now()).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}

          {/* Navigation */}
          <Card mode="outlined" style={styles.card}>
            <Card.Content style={{ padding: 0 }}>
              {SUB_SCREENS.map((s, idx) => (
                <View key={s.route}>
                  {idx > 0 && <Divider />}
                  <View
                    style={styles.navRow}
                  >
                    <Text variant="bodyLarge" style={{ flex: 1, color: theme.colors.onSurface }}>
                      {s.icon}{"  "}{s.label}
                    </Text>
                    <Button
                      mode="text"
                      compact
                      onPress={() => router.push(`/hobbies/${id}/${s.route}`)}
                      textColor={theme.colors.primary}
                    >
                      Open
                    </Button>
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: 8, paddingTop: 4 },
  content: { padding: 16, gap: 12 },
  hero: { paddingBottom: 4 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" },
  statsCard: {},
  statsRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 4 },
  stat: { alignItems: "center", gap: 2 },
  card: {},
  sessionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
