import { StyleSheet, View, ScrollView } from "react-native";
import { Button, Card, Divider, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getSpaceContents } from "../../../lib/api";
import { SkeletonCard } from "../../../components/SkeletonCard";
import { EmptyState } from "../../../components/EmptyState";

export default function SpaceDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: contents, isLoading } = useQuery({
    queryKey: ["space-contents", householdId, id],
    queryFn: () => getSpaceContents(householdId, id),
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
          Spaces
        </Button>
      </View>

      {isLoading || !contents ? (
        <View style={{ padding: 16 }}>
          <SkeletonCard lines={4} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Child spaces */}
          {contents.childSpaces && contents.childSpaces.count > 0 && (
            <Card mode="outlined" style={styles.card}>
              <Card.Title
                title={`Sub-spaces (${contents.childSpaces.count})`}
                titleVariant="titleSmall"
              />
              <Card.Content>
                {contents.childSpaces.names?.map((name: string, idx: number) => (
                  <View key={idx}>
                    {idx > 0 && <Divider style={{ marginVertical: 6 }} />}
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>
                      {name}
                    </Text>
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}

          {/* Inventory items */}
          <Card mode="outlined" style={styles.card}>
            <Card.Title
              title={`Inventory (${contents.inventoryItems?.length ?? 0})`}
              titleVariant="titleSmall"
            />
            <Card.Content>
              {!contents.inventoryItems || contents.inventoryItems.length === 0 ? (
                <EmptyState icon="📦" title="No inventory items" body="No items stored here." />
              ) : (
                contents.inventoryItems.map((item: any, idx: number) => (
                  <View key={item.id}>
                    {idx > 0 && <Divider style={{ marginVertical: 8 }} />}
                    <View style={styles.itemRow}>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                          {item.itemName ?? item.name}
                        </Text>
                        {item.notes && (
                          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {item.notes}
                          </Text>
                        )}
                      </View>
                      <Text
                        variant="titleSmall"
                        style={{ color: theme.colors.primary }}
                      >
                        {item.quantity ?? ""} {item.unit ?? ""}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </Card.Content>
          </Card>

          {/* General items */}
          {contents.generalItems && contents.generalItems.length > 0 && (
            <Card mode="outlined" style={styles.card}>
              <Card.Title
                title={`General Items (${contents.generalItems.length})`}
                titleVariant="titleSmall"
              />
              <Card.Content>
                {contents.generalItems.map((item: any, idx: number) => (
                  <View key={item.id ?? idx}>
                    {idx > 0 && <Divider style={{ marginVertical: 8 }} />}
                    <View style={styles.itemRow}>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                          {item.name}
                        </Text>
                        {item.description && (
                          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {item.description}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: 8, paddingTop: 4 },
  content: { padding: 16, gap: 12 },
  card: {},
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
});
