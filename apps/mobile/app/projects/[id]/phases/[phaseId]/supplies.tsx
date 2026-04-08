import { FlatList, Linking, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Chip, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getProjectDetail, getProjectPhaseSupplies } from "../../../../../lib/api";
import { EmptyState } from "../../../../../components/EmptyState";
import type { ProjectPhaseSupply } from "@aegis/types";

export default function PhaseSuppliesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id: projectId, phaseId } = useLocalSearchParams<{ id: string; phaseId: string }>();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: project } = useQuery({
    queryKey: ["project", householdId, projectId],
    queryFn: () => getProjectDetail(householdId, projectId),
    enabled: !!householdId && !!projectId,
  });

  const { data: supplies, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["phase-supplies", householdId, projectId, phaseId],
    queryFn: () => getProjectPhaseSupplies(householdId, projectId, phaseId),
    enabled: !!householdId && !!projectId && !!phaseId,
  });

  const phase = project?.phases.find((p) => p.id === phaseId);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
          Supplies
        </Button>
        <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
          {phase?.name ?? "Phase Supplies"}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={supplies}
          keyExtractor={(item: ProjectPhaseSupply) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="🔧"
              title="No supplies for this phase"
              body="Add supplies to this phase on the web dashboard."
            />
          }
          renderItem={({ item }: { item: ProjectPhaseSupply }) => (
            <Card mode="outlined" style={styles.card}>
              <Card.Content>
                <View style={styles.itemHeader}>
                  <Text
                    variant="titleSmall"
                    style={{ flex: 1, color: theme.colors.onSurface }}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                  <Chip
                    compact
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: item.isProcured
                          ? theme.colors.secondaryContainer
                          : theme.colors.errorContainer,
                      },
                    ]}
                    textStyle={{
                      color: item.isProcured
                        ? theme.colors.onSecondaryContainer
                        : theme.colors.onErrorContainer,
                    }}
                  >
                    {item.isProcured ? "Procured" : "Needed"}
                  </Chip>
                </View>

                {item.category && (
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
                  >
                    {item.category}
                  </Text>
                )}

                <View style={styles.qtyRow}>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Qty: {item.quantityNeeded} {item.unit}
                    {item.quantityOnHand > 0 ? ` · ${item.quantityOnHand} on hand` : ""}
                  </Text>
                  {item.estimatedUnitCost != null && (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      ${item.estimatedUnitCost.toFixed(2)}/unit
                    </Text>
                  )}
                </View>

                {item.supplier && (
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
                  >
                    Supplier: {item.supplier}
                  </Text>
                )}

                {item.supplierUrl && (
                  <Button
                    mode="text"
                    compact
                    onPress={() => Linking.openURL(item.supplierUrl!)}
                    style={styles.linkBtn}
                  >
                    View supplier
                  </Button>
                )}

                {item.notes && (
                  <Text
                    variant="bodySmall"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      marginTop: 4,
                      fontStyle: "italic",
                    }}
                  >
                    {item.notes}
                  </Text>
                )}
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
  itemHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  statusChip: { borderRadius: 12 },
  qtyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  linkBtn: { alignSelf: "flex-start", marginLeft: -8, marginTop: 2 },
});
