import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { getMe, createInventoryItem } from "../../lib/api";
import { useOfflineSync } from "../../hooks/useOfflineSync";
import { enqueueMutation } from "../../lib/offline-queue";

export default function CreateInventoryItemScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("each");
  const [category, setCategory] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";
  const { isOnline } = useOfflineSync();

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: async () => {
      if (!householdId || !name.trim()) throw new Error("Name is required.");
      const qty = parseFloat(quantity);
      const threshold = reorderThreshold.trim() ? parseFloat(reorderThreshold) : undefined;
      return createInventoryItem(householdId, {
        name: name.trim(),
        quantityOnHand: isNaN(qty) ? 1 : qty,
        unit: unit.trim() || "each",
        category: category.trim() || undefined,
        storageLocation: storageLocation.trim() || undefined,
        reorderThreshold: threshold !== undefined && !isNaN(threshold) ? threshold : undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["inventory", householdId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/inventory/${item.id}`);
    },
    onError: (err: Error) => {
      if (!isOnline) {
        const qty = parseFloat(quantity);
        const threshold = reorderThreshold.trim() ? parseFloat(reorderThreshold) : undefined;
        enqueueMutation({
          method: "POST",
          path: `/v1/households/${householdId}/inventory`,
          body: {
            name: name.trim(),
            quantityOnHand: isNaN(qty) ? 1 : qty,
            unit: unit.trim() || "each",
            category: category.trim() || undefined,
            storageLocation: storageLocation.trim() || undefined,
            reorderThreshold: threshold !== undefined && !isNaN(threshold) ? threshold : undefined,
            notes: notes.trim() || undefined,
          },
          entityType: "inventory",
          description: `Create inventory item: ${name.trim()}`,
        });
        router.replace("/inventory");
      } else {
        setError(err.message);
      }
    },
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
            Inventory
          </Button>
          <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
            New Item
          </Text>
        </View>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <TextInput
              label="Item name *"
              value={name}
              onChangeText={setName}
              mode="outlined"
              placeholder="e.g. Engine Oil 5W-30"
              autoFocus
              style={styles.input}
            />

            <View style={styles.row}>
              <TextInput
                label="Quantity"
                value={quantity}
                onChangeText={setQuantity}
                mode="outlined"
                keyboardType="decimal-pad"
                style={[styles.input, styles.flex1]}
              />
              <View style={styles.rowSpacer} />
              <TextInput
                label="Unit"
                value={unit}
                onChangeText={setUnit}
                mode="outlined"
                placeholder="each / qt / L"
                style={[styles.input, styles.flex1]}
              />
            </View>

            <TextInput
              label="Category"
              value={category}
              onChangeText={setCategory}
              mode="outlined"
              placeholder="e.g. Fluids, Filters (optional)"
              style={styles.input}
            />

            <TextInput
              label="Storage location"
              value={storageLocation}
              onChangeText={setStorageLocation}
              mode="outlined"
              placeholder="e.g. Garage shelf B3 (optional)"
              style={styles.input}
            />

            <TextInput
              label="Reorder threshold"
              value={reorderThreshold}
              onChangeText={setReorderThreshold}
              mode="outlined"
              keyboardType="decimal-pad"
              placeholder="Alert when quantity falls below this"
              style={styles.input}
            />

            <TextInput
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="Any additional notes…"
              style={styles.input}
            />

            {error && (
              <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }}>
                {error}
              </Text>
            )}

            <View style={styles.actions}>
              <Button mode="text" onPress={() => router.back()}>Cancel</Button>
              <Button
                mode="contained"
                onPress={() => create()}
                loading={creating}
                disabled={creating || !name.trim()}
              >
                Create item
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  header: { marginBottom: 4 },
  backBtn: { alignSelf: "flex-start", marginLeft: -8, marginBottom: 4 },
  card: {},
  cardContent: { gap: 8, paddingBottom: 8 },
  input: { marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  rowSpacer: { width: 8 },
  flex1: { flex: 1 },
  actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
});
