import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { getMe, createAsset, getLibraryPresets, applyLibraryPreset } from "../../lib/api";
import type { LibraryPreset } from "../../lib/api";

type AssetCategory =
  | "vehicle" | "home" | "marine" | "aircraft" | "yard"
  | "workshop" | "appliance" | "hvac" | "technology" | "other";

const CATEGORY_OPTIONS: { value: AssetCategory; label: string; icon: string }[] = [
  { value: "vehicle", label: "Vehicle", icon: "🚗" },
  { value: "home", label: "Home", icon: "🏠" },
  { value: "appliance", label: "Appliance", icon: "🫙" },
  { value: "hvac", label: "HVAC", icon: "❄️" },
  { value: "technology", label: "Tech", icon: "💻" },
  { value: "yard", label: "Yard", icon: "🌿" },
  { value: "workshop", label: "Workshop", icon: "🔧" },
  { value: "marine", label: "Marine", icon: "⛵" },
  { value: "aircraft", label: "Aircraft", icon: "✈️" },
  { value: "other", label: "Other", icon: "📦" },
];

type Step = 1 | 2 | 3;

export default function CreateAssetScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Step 1: name + category
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AssetCategory | null>(null);
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");

  // Step 2: preset
  const [selectedPresetKey, setSelectedPresetKey] = useState<string | null>(null);

  // Step 3: optional details
  const [serialNumber, setSerialNumber] = useState("");
  const [description, setDescription] = useState("");

  const [error, setError] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: presets, isLoading: presetsLoading } = useQuery({
    queryKey: ["library-presets"],
    queryFn: getLibraryPresets,
    enabled: step === 2,
  });

  // Filter presets relevant to the selected category
  const relevantPresets = (presets ?? []).filter(
    (p: LibraryPreset) => !category || (p.category ?? "").toLowerCase() === category
  );

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: async () => {
      if (!householdId || !name.trim() || !category) {
        throw new Error("Name and category are required.");
      }
      const asset = await createAsset({
        householdId,
        name: name.trim(),
        category,
        visibility: "shared",
        assetTypeSource: "manual",
        assetTypeVersion: 1,
        fieldDefinitions: [],
        customFields: {},
        manufacturer: manufacturer.trim() || undefined,
        model: model.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        description: description.trim() || undefined,
      });

      // Apply preset if selected
      if (selectedPresetKey) {
        try {
          await applyLibraryPreset(asset.id, {
            source: "library",
            presetKey: selectedPresetKey,
            mergeCustomFields: true,
            skipExistingMetrics: true,
            skipExistingSchedules: true,
          });
        } catch {
          // Non-fatal — asset was created successfully
        }
      }

      return asset;
    },
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: ["assets", householdId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/assets/${asset.id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  const canAdvanceStep1 = name.trim().length > 0 && category !== null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
            Assets
          </Button>
          <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
            New Asset
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            Step {step} of 3
          </Text>
        </View>

        {/* Step indicator */}
        <SegmentedButtons
          value={String(step)}
          onValueChange={() => {}}
          buttons={[
            { value: "1", label: "Basics", disabled: step < 1 },
            { value: "2", label: "Preset", disabled: step < 2 },
            { value: "3", label: "Details", disabled: step < 3 },
          ]}
          style={styles.stepIndicator}
        />

        {/* ── Step 1: Name + Category ── */}
        {step === 1 && (
          <Card mode="outlined" style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <TextInput
                label="Asset name *"
                value={name}
                onChangeText={setName}
                mode="outlined"
                placeholder="e.g. 2018 Honda Civic"
                autoFocus
                style={styles.input}
              />
              <TextInput
                label="Manufacturer"
                value={manufacturer}
                onChangeText={setManufacturer}
                mode="outlined"
                placeholder="Honda"
                style={styles.input}
              />
              <TextInput
                label="Model"
                value={model}
                onChangeText={setModel}
                mode="outlined"
                placeholder="Civic LX"
                style={styles.input}
              />
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurface, marginTop: 8, marginBottom: 8 }}
              >
                Category *
              </Text>
              <View style={styles.categoryGrid}>
                {CATEGORY_OPTIONS.map((cat) => (
                  <Chip
                    key={cat.value}
                    selected={category === cat.value}
                    onPress={() => setCategory(cat.value)}
                    style={styles.categoryChip}
                    compact
                  >
                    {cat.icon} {cat.label}
                  </Chip>
                ))}
              </View>
              <Button
                mode="contained"
                onPress={() => setStep(2)}
                disabled={!canAdvanceStep1}
                style={styles.nextBtn}
              >
                Next
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* ── Step 2: Preset Selection ── */}
        {step === 2 && (
          <Card mode="outlined" style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                Choose a preset to auto-fill maintenance schedules, metrics, and fields. You can skip this.
              </Text>
              {presetsLoading ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <View style={styles.presetList}>
                  <Chip
                    selected={selectedPresetKey === null}
                    onPress={() => setSelectedPresetKey(null)}
                    style={styles.presetChip}
                  >
                    No preset
                  </Chip>
                  {relevantPresets.slice(0, 12).map((preset: LibraryPreset) => (
                    <Chip
                      key={preset.key}
                      selected={selectedPresetKey === preset.key}
                      onPress={() => setSelectedPresetKey(preset.key)}
                      style={styles.presetChip}
                    >
                      {preset.label}
                    </Chip>
                  ))}
                  {relevantPresets.length === 0 && presets && presets.length > 0 && (
                    <>
                      <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.onSurfaceVariant, marginVertical: 4 }}
                      >
                        All presets
                      </Text>
                      {presets.slice(0, 10).map((preset: LibraryPreset) => (
                        <Chip
                          key={preset.key}
                          selected={selectedPresetKey === preset.key}
                          onPress={() => setSelectedPresetKey(preset.key)}
                          style={styles.presetChip}
                        >
                          {preset.label}
                        </Chip>
                      ))}
                    </>
                  )}
                </View>
              )}
              <View style={styles.stepActions}>
                <Button mode="text" onPress={() => setStep(1)}>Back</Button>
                <Button mode="contained" onPress={() => setStep(3)}>Next</Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* ── Step 3: Optional Details + Submit ── */}
        {step === 3 && (
          <Card mode="outlined" style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <TextInput
                label="Serial number"
                value={serialNumber}
                onChangeText={setSerialNumber}
                mode="outlined"
                placeholder="Optional"
                style={styles.input}
              />
              <TextInput
                label="Description"
                value={description}
                onChangeText={setDescription}
                mode="outlined"
                multiline
                numberOfLines={3}
                placeholder="Notes about this asset…"
                style={styles.input}
              />

              {error && (
                <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }}>
                  {error}
                </Text>
              )}

              <View style={styles.stepActions}>
                <Button mode="text" onPress={() => setStep(2)}>Back</Button>
                <Button
                  mode="contained"
                  onPress={() => create()}
                  loading={creating}
                  disabled={creating}
                >
                  Create asset
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  header: { marginBottom: 4 },
  backBtn: { alignSelf: "flex-start", marginLeft: -8, marginBottom: 4 },
  stepIndicator: { marginBottom: 4 },
  card: {},
  cardContent: { gap: 8, paddingBottom: 8 },
  input: { marginBottom: 4 },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  categoryChip: {},
  presetList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  presetChip: {},
  nextBtn: { marginTop: 8 },
  stepActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
});
