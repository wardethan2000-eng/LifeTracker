import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Divider,
  List,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, getAssetDetail, updateAsset } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";

export default function AssetDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editingField, setEditingField] = useState<"name" | "description" | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["asset-detail", id],
    queryFn: () => getAssetDetail(id!),
    enabled: !!id,
  });

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (input: { name?: string; description?: string | undefined }) =>
      updateAsset(id!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["assets", householdId] });
      setEditingField(null);
    },
    onError: (err) => {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Please try again.");
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator style={styles.loader} size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <EmptyState icon="⚠️" title="Couldn't load asset" body="Something went wrong." />
        <Button mode="text" onPress={() => void refetch()} style={{ alignSelf: "center" }}>
          Retry
        </Button>
      </SafeAreaView>
    );
  }

  const { asset, schedules, dueScheduleCount, overdueScheduleCount } = data;

  const startEdit = (field: "name" | "description") => {
    setEditValue(field === "name" ? asset.name : (asset.description ?? ""));
    setEditingField(field);
  };

  const cancelEdit = () => setEditingField(null);

  const commitEdit = () => {
    if (editingField === "name") {
      save({ name: editValue.trim() || asset.name });
    } else if (editingField === "description") {
      save({ description: editValue.trim() || undefined });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Back */}
        <Button
          icon="arrow-left"
          mode="text"
          onPress={() => router.back()}
          style={styles.backBtn}
          labelStyle={{ color: theme.colors.onSurfaceVariant }}
        >
          Assets
        </Button>

        {/* Hero */}
        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            {editingField === "name" ? (
              <View style={styles.editRow}>
                <TextInput
                  value={editValue}
                  onChangeText={setEditValue}
                  mode="outlined"
                  dense
                  style={{ flex: 1 }}
                  autoFocus
                />
                <Button onPress={commitEdit} loading={saving} disabled={saving}>Save</Button>
                <Button onPress={cancelEdit}>Cancel</Button>
              </View>
            ) : (
              <View style={styles.editRow}>
                <Text variant="headlineSmall" style={{ flex: 1, color: theme.colors.onSurface }}>
                  {asset.name}
                </Text>
                <Button mode="text" compact onPress={() => startEdit("name")}>Edit</Button>
              </View>
            )}

            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
              {asset.category}
              {asset.manufacturer ? ` · ${asset.manufacturer}` : ""}
              {asset.model ? ` ${asset.model}` : ""}
              {asset.assetTag ? ` · ${asset.assetTag}` : ""}
            </Text>

            {editingField === "description" ? (
              <View style={[styles.editRow, { marginTop: 8 }]}>
                <TextInput
                  value={editValue}
                  onChangeText={setEditValue}
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  style={{ flex: 1 }}
                  autoFocus
                />
                <Button onPress={commitEdit} loading={saving} disabled={saving}>Save</Button>
                <Button onPress={cancelEdit}>Cancel</Button>
              </View>
            ) : (
              <View style={[styles.editRow, { marginTop: 8 }]}>
                <Text
                  variant="bodyMedium"
                  style={{ flex: 1, color: theme.colors.onSurfaceVariant }}
                  numberOfLines={3}
                >
                  {asset.description ?? "No description"}
                </Text>
                <Button mode="text" compact onPress={() => startEdit("description")}>Edit</Button>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.stat, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
            <Text variant="headlineMedium" style={{ color: overdueScheduleCount > 0 ? theme.colors.error : theme.colors.onSurface }}>
              {overdueScheduleCount}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Overdue</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
            <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
              {dueScheduleCount}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Due</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
            <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
              {schedules.length}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Schedules</Text>
          </View>
          {asset.conditionScore !== null && (
            <View style={[styles.stat, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
              <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
                {asset.conditionScore}/10
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Condition</Text>
            </View>
          )}
        </View>

        {/* Details */}
        {(asset.serialNumber || asset.purchaseDetails || asset.purchaseDate || asset.warrantyDetails || asset.locationDetails) && (
          <Card mode="outlined" style={styles.card}>
            <Card.Title title="Details" titleVariant="titleSmall" />
            <Card.Content>
              {asset.serialNumber && (
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, width: 100 }}>
                    Serial #
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurface, flex: 1 }}>
                    {asset.serialNumber}
                  </Text>
                </View>
              )}
              {asset.purchaseDetails?.price && (
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, width: 100 }}>
                    Purchase price
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurface, flex: 1 }}>
                    ${asset.purchaseDetails.price.toFixed(2)}
                  </Text>
                </View>
              )}
              {asset.purchaseDate && (
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, width: 100 }}>
                    Purchase date
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurface, flex: 1 }}>
                    {new Date(asset.purchaseDate).toLocaleDateString()}
                  </Text>
                </View>
              )}
              {asset.warrantyDetails?.endDate && (
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, width: 100 }}>
                    Warranty
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurface, flex: 1 }}>
                    Expires {new Date(asset.warrantyDetails.endDate).toLocaleDateString()}
                  </Text>
                </View>
              )}
              {asset.locationDetails && (asset.locationDetails.room || asset.locationDetails.building || asset.locationDetails.propertyName) && (
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, width: 100 }}>
                    Location
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurface, flex: 1 }}>
                    {[asset.locationDetails.room, asset.locationDetails.building, asset.locationDetails.propertyName]
                      .filter(Boolean)
                      .join(", ")}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Sub-screen navigation */}
        <Card mode="outlined" style={styles.card}>
          <Card.Title title="Sections" titleVariant="titleSmall" />
          <Divider />
          {[
            { label: "Maintenance Schedules", icon: "calendar-check-outline", route: "schedules" },
            { label: "History", icon: "history", route: "history" },
            { label: "Notes", icon: "notebook-outline", route: "notes" },
            { label: "Comments", icon: "comment-multiple-outline", route: "comments" },
            { label: "Canvas", icon: "vector-square", route: "canvas" },
            { label: "Inventory", icon: "package-variant-closed", route: "inventory" },
            { label: "Photos", icon: "image-multiple-outline", route: "photos" },
            { label: "Share Links", icon: "share-variant-outline", route: "share" },
          ].map(({ label, icon, route }) => (
            <List.Item
              key={route}
              title={label}
              left={(props) => <List.Icon {...props} icon={icon} color={theme.colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push(`/assets/${id}/${route}`)}
            />
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  backBtn: { alignSelf: "flex-start", marginBottom: 4, marginLeft: -8 },
  card: { marginBottom: 0 },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
  },
  editRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  kvRow: { flexDirection: "row", marginBottom: 4 },
});
