import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  Divider,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, getInventoryItemDetail, createInventoryTransaction } from "../../lib/api";
import type { InventoryTransaction } from "../../lib/api";
import { SkeletonCard } from "../../components/SkeletonCard";
import { EmptyState } from "../../components/EmptyState";
import { useOfflineSync } from "../../hooks/useOfflineSync";
import { enqueueMutation } from "../../lib/offline-queue";

type TransactionType = "consume" | "purchase" | "adjust";

const QUICK_ACTIONS: { type: TransactionType; label: string; icon: string }[] = [
  { type: "consume", label: "Consume", icon: "−" },
  { type: "purchase", label: "Restock", icon: "+" },
  { type: "adjust", label: "Adjust", icon: "~" },
];

export default function InventoryItemDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [activeAction, setActiveAction] = useState<TransactionType | null>(null);
  const [qty, setQty] = useState("1");
  const [txNotes, setTxNotes] = useState("");

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";
  const { isOnline } = useOfflineSync();

  const { data: item, isLoading } = useQuery({
    queryKey: ["inventory-item", householdId, id],
    queryFn: () => getInventoryItemDetail(householdId, id),
    enabled: !!householdId && !!id,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createInventoryTransaction(householdId, id, {
        type: activeAction!,
        quantity: Number(qty),
        notes: txNotes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-item", householdId, id] });
      queryClient.invalidateQueries({ queryKey: ["inventory", householdId] });
      setActiveAction(null);
      setQty("1");
      setTxNotes("");
    },
    onError: (err: Error) => {
      if (!isOnline) {
        enqueueMutation({
          method: "POST",
          path: `/v1/households/${householdId}/inventory/${id}/transactions`,
          body: {
            type: activeAction!,
            quantity: Number(qty),
            notes: txNotes.trim() || undefined,
          },
          entityType: "inventory-transactions",
          description: `${activeAction}: ${qty} ${item?.unit ?? "units"} of ${item?.name ?? "item"}`,
        });
        setActiveAction(null);
        setQty("1");
        setTxNotes("");
      } else {
        Alert.alert("Error", err.message ?? "Could not record transaction.");
      }
    },
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
          Inventory
        </Button>
      </View>

      {isLoading || !item ? (
        <View style={{ padding: 16 }}>
          <SkeletonCard lines={4} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Hero */}
          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
                {item.name}
              </Text>
              {item.category && (
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                  {item.category.replace(/_/g, " ")}
                </Text>
              )}
              <View style={styles.qtyRow}>
                <Text
                  variant="displaySmall"
                  style={{
                    color: item.lowStock ? theme.colors.error : theme.colors.primary,
                    marginRight: 8,
                  }}
                >
                  {item.quantityOnHand}
                </Text>
                <View>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                    {item.unit ?? "units"}
                  </Text>
                  {item.lowStock && (
                    <Text variant="labelSmall" style={{ color: theme.colors.error }}>
                      LOW STOCK
                    </Text>
                  )}
                </View>
              </View>
              {item.reorderThreshold != null && (
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Reorder at: {item.reorderThreshold} · Restock qty: {item.reorderQuantity ?? "—"}
                </Text>
              )}
            </Card.Content>
          </Card>

          {/* Quick Actions */}
          <Card mode="outlined" style={styles.card}>
            <Card.Title title="Quick Actions" titleVariant="titleSmall" />
            <Card.Content style={styles.actionsRow}>
              {QUICK_ACTIONS.map((a) => (
                <Button
                  key={a.type}
                  mode={activeAction === a.type ? "contained" : "outlined"}
                  compact
                  onPress={() =>
                    setActiveAction(activeAction === a.type ? null : a.type)
                  }
                  style={{ flex: 1 }}
                >
                  {a.label}
                </Button>
              ))}
            </Card.Content>

            {activeAction && (
              <Card.Content style={{ gap: 8, paddingTop: 8 }}>
                <TextInput
                  label="Quantity"
                  value={qty}
                  onChangeText={(v) => setQty(v.replace(/[^0-9.]/g, ""))}
                  mode="outlined"
                  dense
                  keyboardType="numeric"
                />
                <TextInput
                  label="Notes (optional)"
                  value={txNotes}
                  onChangeText={setTxNotes}
                  mode="outlined"
                  dense
                  multiline
                />
                <View style={styles.editActions}>
                  <Button
                    mode="text"
                    compact
                    onPress={() => { setActiveAction(null); setQty("1"); setTxNotes(""); }}
                    textColor={theme.colors.onSurfaceVariant}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    compact
                    onPress={() => mutation.mutate()}
                    loading={mutation.isPending}
                    disabled={mutation.isPending || !qty || Number(qty) <= 0}
                  >
                    Record {activeAction.charAt(0).toUpperCase() + activeAction.slice(1)}
                  </Button>
                </View>
              </Card.Content>
            )}
          </Card>

          {/* Details */}
          {(item.partNumber || item.storageLocation || item.preferredSupplier || item.unitCost != null) && (
            <Card mode="outlined" style={styles.card}>
              <Card.Title title="Details" titleVariant="titleSmall" />
              <Card.Content style={{ gap: 4 }}>
                {item.partNumber && (
                  <View style={styles.kv}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, minWidth: 80 }}>Part #</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>{item.partNumber}</Text>
                  </View>
                )}
                {item.unitCost != null && (
                  <View style={styles.kv}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, minWidth: 80 }}>Unit cost</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>${item.unitCost}</Text>
                  </View>
                )}
                {item.storageLocation && (
                  <View style={styles.kv}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, minWidth: 80 }}>Location</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>{item.storageLocation}</Text>
                  </View>
                )}
                {item.preferredSupplier && (
                  <View style={styles.kv}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, minWidth: 80 }}>Supplier</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>{item.preferredSupplier}</Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}

          {/* Transaction History */}
          <Card mode="outlined" style={styles.card}>
            <Card.Title title="Recent Transactions" titleVariant="titleSmall" />
            <Card.Content>
              {!item.transactions || item.transactions.length === 0 ? (
                <EmptyState icon="📋" title="No transactions" body="Record a transaction above." />
              ) : (
                item.transactions.slice(0, 20).map((tx: InventoryTransaction, idx: number) => (
                  <View key={tx.id}>
                    {idx > 0 && <Divider style={{ marginVertical: 8 }} />}
                    <View style={styles.txRow}>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>
                          {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                          {tx.notes ? ` · ${tx.notes}` : ""}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <Text
                        variant="titleSmall"
                        style={{
                          color:
                            tx.type === "consume" ? theme.colors.error : theme.colors.primary,
                        }}
                      >
                        {tx.type === "consume" ? "−" : "+"}{tx.quantity}
                      </Text>
                    </View>
                  </View>
                ))
              )}
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
  card: {},
  qtyRow: { flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 4 },
  actionsRow: { flexDirection: "row", gap: 8 },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  kv: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  txRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
});
