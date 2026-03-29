import { useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, FAB, IconButton, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, getEntries, createEntry, updateEntry, deleteEntry } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";
import type { Entry } from "../../../lib/api";

export default function AssetNotesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [editingEntry, setEditingEntry] = useState<{ id: string; body: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["entries", "asset", id],
    queryFn: () =>
      getEntries(householdId, { entityType: "asset", entityId: id!, limit: 50 }),
    enabled: !!householdId && !!id,
  });

  const { mutate: addNote, isPending: saving } = useMutation({
    mutationFn: () =>
      createEntry(householdId, {
        body: noteText.trim(),
        entityType: "asset",
        entityId: id!,
        entryType: "note",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries", "asset", id] });
      setNoteText("");
      setShowForm(false);
    },
    onError: (err: Error) => Alert.alert("Error", err.message ?? "Could not save note."),
  });

  const { mutate: saveEdit, isPending: editSaving } = useMutation({
    mutationFn: () => updateEntry(householdId, editingEntry!.id, { body: editingEntry!.body.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries", "asset", id] });
      setEditingEntry(null);
    },
    onError: (err: Error) => Alert.alert("Error", err.message ?? "Could not update note."),
  });

  const { mutate: remove, isPending: removing } = useMutation({
    mutationFn: () => deleteEntry(householdId, deletingId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries", "asset", id] });
      setDeletingId(null);
    },
    onError: (err: Error) => Alert.alert("Error", err.message ?? "Could not delete note."),
  });

  const entries = data?.items ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
          Asset
        </Button>
        <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
          Notes
        </Text>
      </View>

      {showForm && (
        <Card mode="outlined" style={styles.form}>
          <Card.Content>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              mode="outlined"
              multiline
              numberOfLines={4}
              placeholder="Write a note…"
              autoFocus
            />
            <View style={styles.formActions}>
              <Button onPress={() => setShowForm(false)}>Cancel</Button>
              <Button
                mode="contained"
                onPress={() => addNote()}
                loading={saving}
                disabled={saving || !noteText.trim()}
              >
                Save note
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item: Entry) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="📝"
              title="No notes yet"
              body="Tap + to add a quick note for this asset."
            />
          }
          renderItem={({ item }: { item: Entry }) => (
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
                    <View style={styles.formActions}>
                      <Button onPress={() => setEditingEntry(null)}>Cancel</Button>
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
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                        {item.body}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                        {new Date(item.entryDate ?? item.createdAt).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.noteActions}>
                      <IconButton
                        icon="pencil-outline"
                        size={16}
                        iconColor={theme.colors.onSurfaceVariant}
                        onPress={() => setEditingEntry({ id: item.id, body: item.body })}
                      />
                      <IconButton
                        icon="trash-can-outline"
                        size={16}
                        iconColor={theme.colors.error}
                        onPress={() => setDeletingId(item.id)}
                      />
                    </View>
                  </View>
                )}
                {deletingId === item.id && (
                  <View style={[styles.deleteConfirm, { borderTopColor: theme.colors.outlineVariant }]}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>Delete this note?</Text>
                    <View style={styles.deleteActions}>
                      <Button compact onPress={() => setDeletingId(null)}>Keep</Button>
                      <Button
                        compact
                        onPress={() => remove()}
                        loading={removing}
                        disabled={removing}
                        textColor={theme.colors.error}
                      >
                        Delete
                      </Button>
                    </View>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}
        />
      )}

      {!showForm && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color={theme.colors.onPrimary}
          onPress={() => setShowForm(true)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingBottom: 8 },
  backBtn: { alignSelf: "flex-start", marginLeft: -8, marginBottom: 4 },
  loader: { flex: 1 },
  list: { padding: 16, paddingTop: 4, paddingBottom: 80 },
  card: { marginBottom: 8 },
  form: { margin: 16, marginBottom: 8 },
  formActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 },
  fab: { position: "absolute", right: 16, bottom: 16 },
  noteRow: { flexDirection: "row", alignItems: "flex-start" },
  noteActions: { flexDirection: "column", marginLeft: 4, marginTop: -4 },
  deleteConfirm: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  deleteActions: { flexDirection: "row", justifyContent: "flex-end", gap: 4, marginTop: 2 },
});
