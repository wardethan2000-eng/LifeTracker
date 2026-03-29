import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  getMe,
  getHobbyComments,
  createHobbyComment,
  updateHobbyComment,
  deleteHobbyComment,
} from "../../../lib/api";
import { CommentThread } from "../../../components/CommentThread";
import { EmptyState } from "../../../components/EmptyState";

export default function HobbyCommentsScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const hobbyId = id ?? "";

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: comments, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["hobby-comments", hobbyId],
    queryFn: () => getHobbyComments(householdId, hobbyId),
    enabled: !!householdId && !!hobbyId,
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
              queryKey: ["hobby-comments", hobbyId],
              currentUserId: me?.user.id,
              onCreate: (body, parentCommentId) =>
                createHobbyComment(householdId, hobbyId, { body, parentCommentId }),
              onUpdate: (commentId, body) =>
                updateHobbyComment(householdId, hobbyId, commentId, { body }),
              onDelete: (commentId) =>
                deleteHobbyComment(householdId, hobbyId, commentId),
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
