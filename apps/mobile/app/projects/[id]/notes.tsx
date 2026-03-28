import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, FAB, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, getEntries, createEntry } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";
import type { Entry } from "../../../lib/api";

export default function ProjectNotesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [noteText, setNoteText] = useState("");

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["entries", "project", id],
    queryFn: () =>
      getEntries(householdId, { entityType: "project", entityId: id!, limit: 50 }),
    enabled: !!householdId && !!id,
  });

  const { mutate: addNote, isPending: saving } = useMutation({
    mutationFn: () =>
      createEntry(householdId, {
        body: noteText.trim(),
        entityType: "project",
        entityId: id!,
        entryType: "note",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries", "project", id] });
      setNoteText("");
      setShowForm(false);
    },
  });

  const entries = data?.items ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
          Project
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
            <EmptyState icon="📝" title="No notes yet" body="Tap + to add a note." />
          }
          renderItem={({ item }: { item: Entry }) => (
            <Card mode="outlined" style={styles.card}>
              <Card.Content>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                  {item.body}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                  {new Date(item.entryDate ?? item.createdAt).toLocaleString()}
                </Text>
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
});
