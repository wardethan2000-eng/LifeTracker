import { ScrollView, StyleSheet } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  getMe,
  getProjectComments,
  createProjectComment,
  updateProjectComment,
  deleteProjectComment,
} from "../../../lib/api";
import { CommentThread } from "../../../components/CommentThread";

export default function ProjectCommentsScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id ?? "";

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: comments, isLoading } = useQuery({
    queryKey: ["project-comments", projectId],
    queryFn: () => getProjectComments(householdId, projectId),
    enabled: !!householdId && !!projectId,
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
              queryKey: ["project-comments", projectId],
              currentUserId: me?.user.id,
              onCreate: (body, parentCommentId) =>
                createProjectComment(householdId, projectId, { body, parentCommentId }),
              onUpdate: (commentId, body) =>
                updateProjectComment(householdId, projectId, commentId, { body }),
              onDelete: (commentId) =>
                deleteProjectComment(householdId, projectId, commentId),
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
