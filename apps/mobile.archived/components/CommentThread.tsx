/**
 * CommentThread — reusable threaded comment component.
 * Renders the full list of top-level comments with nested replies.
 * Handles create, edit, delete for the current user's comments.
 */
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Button, Divider, IconButton, Text, TextInput, useTheme } from "react-native-paper";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import type { ThreadedComment, Comment } from "../lib/api";

type CommentActions = {
  onCreate: (body: string, parentCommentId?: string) => Promise<Comment>;
  onUpdate: (commentId: string, body: string) => Promise<Comment>;
  onDelete: (commentId: string) => Promise<void>;
  /** TanStack Query key to invalidate on mutation */
  queryKey: unknown[];
  currentUserId: string | undefined;
};

type Props = {
  comments: ThreadedComment[];
  actions: CommentActions;
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function CommentItem({
  comment,
  depth,
  actions,
  currentUserId,
}: {
  comment: ThreadedComment | Comment;
  depth: number;
  actions: CommentActions;
  currentUserId: string | undefined;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");

  const isOwn = currentUserId && comment.authorId === currentUserId;

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => actions.onUpdate(comment.id, editBody.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: actions.queryKey });
      setEditing(false);
    },
    onError: () => Alert.alert("Error", "Could not save your edit. Please try again."),
  });

  const { mutate: destroy, isPending: destroying } = useMutation({
    mutationFn: () => actions.onDelete(comment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: actions.queryKey });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onError: () => Alert.alert("Error", "Could not delete the comment. Please try again."),
  });

  const { mutate: reply, isPending: sendingReply } = useMutation({
    mutationFn: () => actions.onCreate(replyBody.trim(), comment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: actions.queryKey });
      setReplying(false);
      setReplyBody("");
    },
    onError: () => Alert.alert("Error", "Could not post your reply. Please try again."),
  });

  const deleted = !!comment.deletedAt;
  const replies = "replies" in comment ? (comment as ThreadedComment).replies : [];

  return (
    <View style={[styles.commentBlock, { marginLeft: depth * 16 }]}>
      <View style={styles.commentRow}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: theme.colors.secondaryContainer },
          ]}
        >
          <Text variant="labelSmall" style={{ color: theme.colors.onSecondaryContainer }}>
            {(comment.author?.displayName ?? "?")[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.commentMeta}>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurface }}>
              {comment.author?.displayName ?? "Unknown"}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 6 }}>
              {formatRelativeTime(comment.createdAt)}
              {comment.editedAt ? "  (edited)" : ""}
            </Text>
          </View>

          {deleted ? (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, fontStyle: "italic" }}
            >
              [deleted]
            </Text>
          ) : editing ? (
            <View style={{ marginTop: 4 }}>
              <TextInput
                value={editBody}
                onChangeText={setEditBody}
                mode="outlined"
                multiline
                dense
                style={styles.inlineInput}
              />
              <View style={styles.inlineActions}>
                <Button mode="text" compact onPress={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  compact
                  onPress={() => save()}
                  loading={saving}
                  disabled={saving || !editBody.trim()}
                >
                  Save
                </Button>
              </View>
            </View>
          ) : (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, marginTop: 2 }}>
              {comment.body}
            </Text>
          )}

          {!deleted && !editing && (
            <View style={styles.commentActions}>
              {depth === 0 && (
                <Button
                  mode="text"
                  compact
                  onPress={() => setReplying((v) => !v)}
                  style={styles.actionBtn}
                >
                  Reply
                </Button>
              )}
              {isOwn && (
                <>
                  <Button
                    mode="text"
                    compact
                    onPress={() => {
                      setEditBody(comment.body);
                      setEditing(true);
                    }}
                    style={styles.actionBtn}
                  >
                    Edit
                  </Button>
                  <Button
                    mode="text"
                    compact
                    onPress={() =>
                      Alert.alert(
                        "Delete comment?",
                        "This cannot be undone.",
                        [
                          { text: "Delete", style: "destructive", onPress: () => destroy() },
                          { text: "Cancel", style: "cancel" },
                        ]
                      )
                    }
                    loading={destroying}
                    disabled={destroying}
                    textColor={theme.colors.error}
                    style={styles.actionBtn}
                  >
                    Delete
                  </Button>
                </>
              )}
            </View>
          )}
        </View>
      </View>

      {replying && (
        <View style={[styles.replyBox, { marginLeft: 36 }]}>
          <TextInput
            value={replyBody}
            onChangeText={setReplyBody}
            mode="outlined"
            placeholder="Write a reply…"
            multiline
            dense
            style={styles.inlineInput}
            autoFocus
          />
          <View style={styles.inlineActions}>
            <Button mode="text" compact onPress={() => setReplying(false)}>
              Cancel
            </Button>
            <Button
              mode="contained"
              compact
              onPress={() => reply()}
              loading={sendingReply}
              disabled={sendingReply || !replyBody.trim()}
            >
              Reply
            </Button>
          </View>
        </View>
      )}

      {replies.map((r) => (
        <CommentItem
          key={r.id}
          comment={r}
          depth={depth + 1}
          actions={actions}
          currentUserId={currentUserId}
        />
      ))}
    </View>
  );
}

export function CommentThread({ comments, actions }: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [newBody, setNewBody] = useState("");

  const { mutate: post, isPending: posting } = useMutation({
    mutationFn: () => actions.onCreate(newBody.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: actions.queryKey });
      setNewBody("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  return (
    <View style={styles.root}>
      {/* Compose new comment */}
      <View style={[styles.composeBox, { borderColor: theme.colors.outline }]}>
        <TextInput
          value={newBody}
          onChangeText={setNewBody}
          mode="outlined"
          placeholder="Add a comment…"
          multiline
          numberOfLines={3}
          style={styles.composeInput}
        />
        <Button
          mode="contained"
          onPress={() => post()}
          loading={posting}
          disabled={posting || !newBody.trim()}
          style={styles.postBtn}
        >
          Post
        </Button>
      </View>

      <Divider style={{ marginVertical: 8 }} />

      {comments.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
            No comments yet
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Be the first to comment.
          </Text>
        </View>
      ) : (
        comments.map((c, i) => (
          <View key={c.id}>
            {i > 0 && <Divider style={{ marginVertical: 6 }} />}
            <CommentItem
              comment={c}
              depth={0}
              actions={actions}
              currentUserId={actions.currentUserId}
            />
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: 32 },
  composeBox: { gap: 8, paddingBottom: 4 },
  composeInput: {},
  postBtn: { alignSelf: "flex-end" },
  empty: { alignItems: "center", paddingVertical: 32, gap: 6 },
  emptyIcon: { fontSize: 32 },
  commentBlock: { paddingVertical: 6 },
  commentRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  commentMeta: { flexDirection: "row", alignItems: "center" },
  commentActions: { flexDirection: "row", marginTop: 2, marginLeft: -8 },
  actionBtn: { minWidth: 0 },
  inlineInput: { marginBottom: 4 },
  inlineActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  replyBox: { marginTop: 8, gap: 4 },
});
