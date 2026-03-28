import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, IconButton, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EntryTypeChips } from "../../components/EntryTypeChips";
import { FlagChips } from "../../components/FlagChips";
import { OfflineBanner } from "../../components/OfflineBanner";
import {
  createEntry,
  getMe,
  type EntryFlag,
  type EntryType,
} from "../../lib/api";
import { useOfflineSync } from "../../hooks/useOfflineSync";
import { enqueueMutation } from "../../lib/offline-queue";

export default function CaptureScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { isOnline } = useOfflineSync();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("note");
  const [flags, setFlags] = useState<EntryFlag[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: async () => {
      if (!householdId) throw new Error("No household");
      return createEntry(householdId, {
        body: body.trim(),
        title: title.trim() || null,
        entityType: "home",
        entityId: householdId,
        entryType,
        flags,
        entryDate: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      setBody("");
      setTitle("");
      setEntryType("note");
      setFlags([]);
      setPhotoUri(null);
    },
    onError: (err) => {
      if (!isOnline) {
        enqueueMutation({
          method: "POST",
          path: `/v1/households/${householdId}/entries`,
          body: {
            body: body.trim(),
            title: title.trim() || null,
            entityType: "home",
            entityId: householdId,
            entryType,
            flags,
            entryDate: new Date().toISOString(),
          },
          entityType: "entries",
          description: `Create ${entryType}: ${title.trim() || body.trim().slice(0, 40)}`,
        });
        setBody("");
        setTitle("");
        setEntryType("note");
        setFlags([]);
        setPhotoUri(null);
      } else {
        Alert.alert("Error", err instanceof Error ? err.message : "Failed to save note.");
      }
    },
  });

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    const compressed = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 800 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    setPhotoUri(compressed.uri);
  }

  async function takePhoto() {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    const compressed = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 800 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    setPhotoUri(compressed.uri);
  }

  const canSave = !!body.trim() && !saving;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text variant="headlineSmall" style={[styles.heading, { color: theme.colors.onBackground }]}>
          Capture
        </Text>

        <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
          Type
        </Text>
        <EntryTypeChips value={entryType} onChange={setEntryType} />

        <TextInput
          label="Title (optional)"
          value={title}
          onChangeText={setTitle}
          mode="outlined"
          style={styles.input}
          dense
        />

        <TextInput
          label="What are you noting?"
          value={body}
          onChangeText={setBody}
          mode="outlined"
          multiline
          numberOfLines={5}
          style={styles.input}
          placeholder="Type a note, observation, or measurement…"
        />

        <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
          Flags
        </Text>
        <FlagChips value={flags} onChange={setFlags} />

        <View style={styles.photoRow}>
          <Button mode="outlined" icon="camera" onPress={takePhoto} compact style={styles.photoBtn}>
            Camera
          </Button>
          <Button mode="outlined" icon="image" onPress={pickPhoto} compact style={styles.photoBtn}>
            Gallery
          </Button>
        </View>

        {photoUri ? (
          <View style={styles.photoPreview}>
            <Image source={{ uri: photoUri }} style={styles.photoImage} resizeMode="cover" />
            <IconButton
              icon="close-circle"
              size={20}
              onPress={() => setPhotoUri(null)}
              style={styles.photoRemove}
            />
          </View>
        ) : null}

        <Button
          mode="contained"
          onPress={() => save()}
          disabled={!canSave}
          style={styles.saveButton}
          loading={saving}
        >
          {isOnline ? `Save ${entryType.charAt(0).toUpperCase()}${entryType.slice(1)}` : "Save (offline)"}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 8, paddingBottom: 40 },
  heading: { marginBottom: 4 },
  sectionLabel: { marginBottom: 2, marginTop: 4 },
  input: { marginBottom: 4 },
  photoRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  photoBtn: { flex: 1 },
  photoPreview: { position: "relative" },
  photoImage: { width: "100%", height: 180, borderRadius: 8, marginTop: 8 },
  photoRemove: { position: "absolute", top: 4, right: 0 },
  saveButton: { marginTop: 8 },
});
