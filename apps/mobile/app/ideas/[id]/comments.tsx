import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  getMe,
  getIdeaComments,
  createIdeaComment,
  updateIdeaComment,
  deleteIdeaComment,
} from "../../../lib/api";
import { CommentThread } from "../../../components/CommentThread";
import { EmptyState } from "../../../components/EmptyState";

export default function IdeaCommentsScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ideaId = id ?? "";

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: comments, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["idea-comments", ideaId],
    queryFn: () => getIdeaComments(householdId, ideaId),
    enabled: !!householdId && !!ideaId,
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <Text
          variant="titleMedium"
          style={{ color: theme.colors.onBackground, marginBottom: 12 }}
        >
          Comments
        </Text>
        {isLoading ? (
          <ActivityIndicator />
        ) : error ? (
          <EmptyState icon="💬" title="Could not load comments" body="Pull down to try again." />
        ) : (
          <CommentThread
            comments={comments ?? []}
            actions={{
              queryKey: ["idea-comments", ideaId],
              currentUserId: me?.user.id,
              onCreate: (body, parentCommentId) =>
                createIdeaComment(householdId, ideaId, { body, parentCommentId }),
              onUpdate: (commentId, body) =>
                updateIdeaComment(householdId, ideaId, commentId, { body }),
              onDelete: (commentId) =>
                deleteIdeaComment(householdId, ideaId, commentId),
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
