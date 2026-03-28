import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Button, Card, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, getEntries, createEntry } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonCard } from "../../../components/SkeletonCard";

export default function IdeaNotesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [body, setBody] = useState("");

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: entries = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["idea-notes", householdId, id],
    queryFn: () => getEntries(householdId, { entityType: "idea", entityId: id, limit: 50 }),
    enabled: !!householdId && !!id,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createEntry(householdId, { body: body.trim(), entityType: "idea", entityId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["idea-notes", householdId, id] });
      setShowCreate(false);
      setBody("");
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
          Idea
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
            <EmptyState
              icon="📝"
              title="No notes yet"
              body="Add notes, observations, or thoughts about this idea."
            />
          }
          renderItem={({ item }) => (
            <Card mode="outlined" style={styles.card}>
              <Card.Content>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                  {item.body}
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  createCard: { margin: 16, marginTop: 8 },
  createActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  list: { padding: 16, paddingTop: 8, gap: 8 },
  card: {},
});
