import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Button, Card, IconButton, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, getEntries, createEntry, updateEntry, deleteEntry } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonCard } from "../../../components/SkeletonCard";

export default function HobbyNotesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [body, setBody] = useState("");
  const [editingEntry, setEditingEntry] = useState<{ id: string; body: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: entriesData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["hobby-notes", householdId, id],
    queryFn: () => getEntries(householdId, { entityType: "hobby", entityId: id, limit: 50 }),
    enabled: !!householdId && !!id,
  });
  const entries = entriesData?.items ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      createEntry(householdId, { body: body.trim(), entityType: "hobby", entityId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hobby-notes", householdId, id] });
      setShowCreate(false);
      setBody("");
    },
  });

  const { mutate: saveEdit, isPending: editSaving } = useMutation({
    mutationFn: () => updateEntry(householdId, editingEntry!.id, { body: editingEntry!.body.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hobby-notes", householdId, id] });
      setEditingEntry(null);
    },
  });

  const { mutate: remove, isPending: removing } = useMutation({
    mutationFn: () => deleteEntry(householdId, deletingId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hobby-notes", householdId, id] });
      setDeletingId(null);
    },
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.topBar}>
        <Button
          icon="arrow-left"
          mode="text"
          compact
          onPress={() => router.back()}
          textColor={theme.colors.primary}
        >
          Hobby
        </Button>
        <Button
          icon="plus"
          mode="text"
          compact
          onPress={() => setShowCreate(true)}
          textColor={theme.colors.primary}
        >
          Add
        </Button>
      </View>

      <Text variant="titleMedium" style={{ paddingHorizontal: 16, color: theme.colors.onBackground }}>
        Notes
      </Text>

      {showCreate && (
        <Card mode="elevated" style={styles.createCard}>
          <Card.Content style={{ gap: 8 }}>
            <TextInput
              label="Note"
              value={body}
              onChangeText={setBody}
              mode="outlined"
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={styles.createActions}>
              <Button
                mode="text"
                onPress={() => { setShowCreate(false); setBody(""); }}
                textColor={theme.colors.onSurfaceVariant}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={() => mutation.mutate()}
                loading={mutation.isPending}
                disabled={mutation.isPending || !body.trim()}
              >
                Save Note
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {isLoading ? (
        <View style={{ padding: 16 }}>{[1, 2].map((n) => <SkeletonCard key={n} />)}</View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState icon="ðŸ“" title="No notes yet" body="Add a note to start journaling this hobby." />
          }
          renderItem={({ item }) => (
            <Card mode="outlined" style={styles.card}>
              <Card.Content>
                {editingEntry?.id === item.id ? (
                  <View>
                    <TextInput
                      value={editingEntry.body}
                      onChangeText={(t) => setEditingEntry({ id: item.id, body: t })}
                      mode="outlined"
                      multiline
                      numberOfLines={4}
                      autoFocus
                    />
                    <View style={styles.createActions}>
                      <Button mode="text" onPress={() => setEditingEntry(null)} textColor={theme.colors.onSurfaceVariant}>Cancel</Button>
                      <Button
                        mode="contained"
                        onPress={() => saveEdit()}
                        loading={editSaving}
                        disabled={editSaving || !editingEntry.body.trim()}
                      >
                        Save
                      </Button>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noteRow}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>{item.body}</Text>
                      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.noteActions}>
                      <IconButton icon="pencil-outline" size={16} iconColor={theme.colors.onSurfaceVariant}
                        onPress={() => setEditingEntry({ id: item.id, body: item.body })} />
                      <IconButton icon="trash-can-outline" size={16} iconColor={theme.colors.error}
                        onPress={() => setDeletingId(item.id)} />
                    </View>
                  </View>
                )}
                {deletingId === item.id && (
                  <View style={[styles.deleteConfirm, { borderTopColor: theme.colors.outlineVariant }]}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>Delete this note?</Text>
                    <View style={styles.deleteActions}>
                      <Button compact onPress={() => setDeletingId(null)}>Keep</Button>
                      <Button compact onPress={() => remove()} loading={removing} disabled={removing} textColor={theme.colors.error}>Delete</Button>
                    </View>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  createCard: { margin: 16, marginBottom: 4 },
  createActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  list: { padding: 16, paddingTop: 8 },
  card: { marginBottom: 8 },
  noteRow: { flexDirection: "row", alignItems: "flex-start" },
  noteActions: { flexDirection: "column", marginLeft: 4, marginTop: -4 },
  deleteConfirm: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  deleteActions: { flexDirection: "row", justifyContent: "flex-end", gap: 4, marginTop: 2 },
});
