import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Button, Card, Divider, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, getHobbySessions, createHobbySession } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonCard } from "../../../components/SkeletonCard";
import { StatusPill } from "../../../components/StatusPill";
import type { HobbySessionSummary } from "../../../lib/api";

interface CreateForm {
  name: string;
  notes: string;
}

export default function HobbySessionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>({ name: "", notes: "" });
  const [fieldError, setFieldError] = useState("");

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: sessions = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["hobby-sessions", householdId, id],
    queryFn: () => getHobbySessions(householdId, id),
    enabled: !!householdId && !!id,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createHobbySession(householdId, id, {
        name: form.name.trim(),
        startDate: new Date().toISOString(),
        completedDate: new Date().toISOString(),
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hobby-sessions", householdId, id] });
      queryClient.invalidateQueries({ queryKey: ["hobby", householdId, id] });
      setShowCreate(false);
      setForm({ name: "", notes: "" });
    },
  });

  const handleSave = () => {
    if (!form.name.trim()) {
      setFieldError("Session name is required");
      return;
    }
    setFieldError("");
    mutation.mutate();
  };

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
          Log
        </Button>
      </View>

      <Text variant="titleMedium" style={{ paddingHorizontal: 16, color: theme.colors.onBackground }}>
        Sessions
      </Text>

      {showCreate && (
        <Card mode="elevated" style={styles.createCard}>
          <Card.Title title="Log Session" titleVariant="titleSmall" />
          <Card.Content style={{ gap: 8 }}>
            <TextInput
              label="Session name"
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              mode="outlined"
              dense
              error={!!fieldError}
            />
            {fieldError ? (
              <Text style={{ color: theme.colors.error }} variant="labelSmall">
                {fieldError}
              </Text>
            ) : null}
            <TextInput
              label="Notes (optional)"
              value={form.notes}
              onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
              mode="outlined"
              dense
              multiline
              numberOfLines={3}
            />
            <View style={styles.createActions}>
              <Button
                mode="text"
                onPress={() => {
                  setShowCreate(false);
                  setForm({ name: "", notes: "" });
                  setFieldError("");
                }}
                textColor={theme.colors.onSurfaceVariant}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                loading={mutation.isPending}
                disabled={mutation.isPending}
              >
                Save Session
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {isLoading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </View>
      ) : (
        <FlatList
          data={sessions as HobbySessionSummary[]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon="▶"
              title="No sessions yet"
              body="Log your first session to start tracking."
            />
          }
          renderItem={({ item }: { item: HobbySessionSummary }) => (
            <Card mode="outlined" style={styles.card}>
              <Card.Content>
                <View style={styles.sessionHeader}>
                  <Text
                    variant="titleSmall"
                    style={{ flex: 1, color: theme.colors.onSurface }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <StatusPill status={item.status} />
                </View>
                {item.recipeName && (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                    {item.recipeName}
                  </Text>
                )}
                <Divider style={{ marginVertical: 6 }} />
                <View style={styles.dateRow}>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Started {item.startDate ? new Date(item.startDate).toLocaleDateString() : "—"}
                  </Text>
                  {item.completedDate && (
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      Completed {new Date(item.completedDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
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
  createActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  list: { padding: 16, paddingTop: 8 },
  card: { marginBottom: 8 },
  sessionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateRow: { flexDirection: "row", gap: 16 },
});
