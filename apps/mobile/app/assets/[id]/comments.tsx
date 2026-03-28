import { ScrollView, StyleSheet } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  getMe,
  getAssetComments,
  createAssetComment,
  updateAssetComment,
  deleteAssetComment,
} from "../../../lib/api";
import { CommentThread } from "../../../components/CommentThread";

export default function AssetCommentsScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const assetId = id ?? "";

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const { data: comments, isLoading } = useQuery({
    queryKey: ["asset-comments", assetId],
    queryFn: () => getAssetComments(assetId),
    enabled: !!assetId,
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text
          variant="titleMedium"
          style={{ color: theme.colors.onBackground, marginBottom: 12 }}
        >
          Comments
        </Text>
        {isLoading ? (
          <ActivityIndicator />
        ) : (
          <CommentThread
            comments={comments ?? []}
            actions={{
              queryKey: ["asset-comments", assetId],
              currentUserId: me?.user.id,
              onCreate: (body, parentCommentId) =>
                createAssetComment(assetId, { body, parentCommentId }),
              onUpdate: (commentId, body) =>
                updateAssetComment(assetId, commentId, { body }),
              onDelete: (commentId) => deleteAssetComment(assetId, commentId),
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16 },
});
