import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Dialog,
  FAB,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmAttachmentUpload,
  deleteAttachment,
  getAttachmentDownloadUrl,
  getEntityAttachments,
  getMe,
  requestAttachmentUpload,
  type Attachment,
} from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";

const COLUMNS = 2;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TILE_SIZE = (SCREEN_WIDTH - 16 * 2 - 8) / COLUMNS; // 16px margin each side, 8px gap

// ---------------------------------------------------------------------------
// PhotoTile — lazy-loads download URL for image preview
// ---------------------------------------------------------------------------
function PhotoTile({
  attachment,
  householdId,
  onDelete,
}: {
  attachment: Attachment;
  householdId: string;
  onDelete: (id: string) => void;
}) {
  const theme = useTheme();
  const isImage = attachment.mimeType.startsWith("image/");

  const { data: urlData, isLoading } = useQuery({
    queryKey: ["attachment-url", attachment.id],
    queryFn: () => getAttachmentDownloadUrl(householdId, attachment.id),
    staleTime: 5 * 60 * 1000,
    enabled: !!householdId,
  });

  async function open() {
    if (urlData?.url) {
      await Linking.openURL(urlData.url);
    }
  }

  return (
    <Pressable
      onPress={open}
      onLongPress={() => onDelete(attachment.id)}
      style={[styles.tile, { backgroundColor: theme.colors.surfaceVariant }]}
      accessibilityLabel={attachment.originalFilename}
      accessibilityHint="Tap to open, long-press to delete"
    >
      {isLoading ? (
        <ActivityIndicator size="small" style={styles.tileLoader} />
      ) : isImage && urlData?.url ? (
        <Image
          source={{ uri: urlData.url }}
          style={styles.tileImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.fileIcon}>
          <Text style={styles.fileEmoji}>
            {attachment.mimeType.includes("pdf") ? "📄" : "📎"}
          </Text>
        </View>
      )}
      <View style={[styles.tileLabel, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
        <Text
          numberOfLines={1}
          style={styles.tileLabelText}
        >
          {attachment.originalFilename}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function AssetPhotosScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["asset-attachments", id],
    queryFn: () => getEntityAttachments(householdId, "asset", id!),
    enabled: !!householdId && !!id,
  });

  // ── Delete flow (long-press → confirm dialog) ──
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { mutate: confirmDelete, isPending: deleting } = useMutation({
    mutationFn: () => deleteAttachment(householdId, deleteTargetId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-attachments", id] });
      setDeleteTargetId(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Alert.alert("Error", "Could not delete the photo. Please try again.");
    },
  });

  // ── Upload flow ──
  const [uploading, setUploading] = useState(false);

  async function handlePickAndUpload(useCamera: boolean) {
    if (!householdId || !id) return;

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsMultipleSelection: true });

    if (result.canceled || !result.assets.length) return;

    setUploading(true);
    try {
      for (const asset of result.assets) {
        const compressed = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );

        const fileInfo = await FileSystem.getInfoAsync(compressed.uri, { size: true });
        const fileSize = fileInfo.exists && "size" in fileInfo ? (fileInfo.size ?? 0) : 0;
        const filename = compressed.uri.split("/").pop() ?? "photo.jpg";

        // Step 1: request upload URL
        const { attachment, uploadUrl } = await requestAttachmentUpload(householdId, {
          entityType: "asset",
          entityId: id,
          filename,
          mimeType: "image/jpeg",
          fileSize,
        });

        // Step 2: PUT file to presigned S3 URL
        await FileSystem.uploadAsync(uploadUrl, compressed.uri, {
          httpMethod: "PUT",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { "Content-Type": "image/jpeg" },
        });

        // Step 3: confirm
        await confirmAttachmentUpload(householdId, attachment.id);
      }

      queryClient.invalidateQueries({ queryKey: ["asset-attachments", id] });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUploading(false);
    }
  }

  function showAddOptions() {
    Alert.alert("Add photo", "Choose source", [
      { text: "Camera", onPress: () => handlePickAndUpload(true) },
      { text: "Photo library", onPress: () => handlePickAndUpload(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
          Asset
        </Button>
        <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
          Photos & Files
        </Text>
      </View>

      {/* Grid */}
      {isLoading ? (
        <ActivityIndicator style={styles.loader} />
      ) : attachments.length === 0 ? (
        <EmptyState
          icon="📸"
          title="No photos yet"
          body="Tap + to add photos or documents to this asset."
        />
      ) : (
        <FlatList
          data={attachments}
          keyExtractor={(item) => item.id}
          numColumns={COLUMNS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <PhotoTile
              attachment={item}
              householdId={householdId}
              onDelete={setDeleteTargetId}
            />
          )}
        />
      )}

      {/* FAB */}
      <FAB
        icon={uploading ? "loading" : "plus"}
        label={uploading ? "Uploading…" : "Add photo"}
        onPress={showAddOptions}
        disabled={uploading || !householdId}
        style={styles.fab}
      />

      {/* Delete confirm dialog */}
      <Portal>
        <Dialog
          visible={!!deleteTargetId}
          onDismiss={() => setDeleteTargetId(null)}
        >
          <Dialog.Title>Delete photo?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This will permanently remove the photo from this asset.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteTargetId(null)}>Cancel</Button>
            <Button
              onPress={() => confirmDelete()}
              loading={deleting}
              textColor={theme.colors.error}
            >
              Delete photo
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingBottom: 8 },
  backBtn: { alignSelf: "flex-start", marginLeft: -8, marginBottom: 4 },
  loader: { flex: 1, justifyContent: "center" },
  grid: { padding: 16, paddingBottom: 100 },
  row: { gap: 8, marginBottom: 8 },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  tileLoader: { flex: 1 },
  tileImage: { width: "100%", height: "100%" },
  fileIcon: { flex: 1, justifyContent: "center", alignItems: "center" },
  fileEmoji: { fontSize: 36 },
  tileLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 4,
  },
  tileLabelText: {
    color: "#fff",
    fontSize: 10,
    lineHeight: 14,
  },
  fab: { position: "absolute", right: 16, bottom: 24 },
});

