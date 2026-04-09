import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Divider,
  List,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, getIdea, updateIdea, updateIdeaStage, getEntries } from "../../../lib/api";
import { SkeletonCard } from "../../../components/SkeletonCard";
import { StatusPill } from "../../../components/StatusPill";
import { EmptyState } from "../../../components/EmptyState";

const STAGES = ["spark", "developing", "ready"] as const;

const PRIORITY_COLORS: Record<string, string> = {
  low: "#888",
  medium: "#f0a500",
  high: "#d32f2f",
};

export default function IdeaDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [editingField, setEditingField] = useState<"title" | "description" | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: idea, isLoading, error } = useQuery({
    queryKey: ["idea", householdId, id],
    queryFn: () => getIdea(householdId, id),
    enabled: !!householdId && !!id,
  });

  const { data: notesData } = useQuery({
    queryKey: ["idea-notes", householdId, id],
    queryFn: () => getEntries(householdId, { entityType: "idea", entityId: id, limit: 5 }),
    enabled: !!householdId && !!id,
  });
  const recentNotes = notesData?.items ?? [];

  const updateMutation = useMutation({
    mutationFn: (input: { title?: string; description?: string | null }) =>
      updateIdea(householdId, id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(["idea", householdId, id], updated);
      queryClient.invalidateQueries({ queryKey: ["ideas", householdId] });
      setEditingField(null);
    },
    onError: (err) => {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Please try again.");
    },
  });

  const stageMutation = useMutation({
    mutationFn: (stage: string) => updateIdeaStage(householdId, id, stage as any),
    onSuccess: (updated) => {
      queryClient.setQueryData(["idea", householdId, id], updated);
      queryClient.invalidateQueries({ queryKey: ["ideas", householdId] });
    },
    onError: (err) => {
      Alert.alert("Update failed", err instanceof Error ? err.message : "Please try again.");
    },
  });

  const startEdit = (field: "title" | "description") => {
    if (!idea) return;
    setEditValue(field === "title" ? idea.title : idea.description ?? "");
    setEditingField(field);
  };

  const saveEdit = () => {
    if (!editingField || !idea) return;
    if (editingField === "title" && editValue.trim()) {
      updateMutation.mutate({ title: editValue.trim() });
    } else if (editingField === "description") {
      updateMutation.mutate({ description: editValue.trim() || null });
    }
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
          Ideas
        </Button>
      </View>

      {isLoading ? (
        <View style={{ padding: 16 }}>
          <SkeletonCard lines={4} />
        </View>
      ) : error || !idea ? (
        <EmptyState icon="⚠️" title="Couldn't load idea" body="Pull down to retry." />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Title */}
          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              {editingField === "title" ? (
                <View style={styles.editRow}>
                  <TextInput
                    value={editValue}
                    onChangeText={setEditValue}
                    mode="outlined"
                    dense
                    style={{ flex: 1 }}
                  />
                  <Button
                    mode="contained"
                    compact
                    onPress={saveEdit}
                    loading={updateMutation.isPending}
                    disabled={updateMutation.isPending || !editValue.trim()}
                  >
                    Save
                  </Button>
                  <Button
                    mode="text"
                    compact
                    onPress={() => setEditingField(null)}
                    textColor={theme.colors.onSurfaceVariant}
                  >
                    Cancel
                  </Button>
                </View>
              ) : (
                <View style={styles.fieldRow}>
                  <Text
                    variant="headlineSmall"
                    style={{ flex: 1, color: theme.colors.onSurface }}
                  >
                    {idea.title}
                  </Text>
                  <Button
                    mode="text"
                    compact
                    onPress={() => startEdit("title")}
                    textColor={theme.colors.primary}
                  >
                    Edit
                  </Button>
                </View>
              )}

              <View style={styles.pillRow}>
                <StatusPill status={idea.archivedAt ? "archived" : idea.stage} />
                <Text
                  variant="labelSmall"
                  style={{ color: PRIORITY_COLORS[idea.priority] ?? theme.colors.onSurfaceVariant }}
                >
                  {idea.priority.toUpperCase()} PRIORITY
                </Text>
                {idea.category && (
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {idea.category.replace(/_/g, " ")}
                  </Text>
                )}
              </View>
            </Card.Content>
          </Card>

          {/* Description */}
          <Card mode="outlined" style={styles.card}>
            <Card.Title
              title="Description"
              titleVariant="titleSmall"
              right={(props) => (
                <Button
                  {...props}
                  mode="text"
                  compact
                  onPress={() => startEdit("description")}
                  textColor={theme.colors.primary}
                >
                  {idea.description ? "Edit" : "Add"}
                </Button>
              )}
            />
            <Card.Content>
              {editingField === "description" ? (
                <View style={{ gap: 8 }}>
                  <TextInput
                    value={editValue}
                    onChangeText={setEditValue}
                    mode="outlined"
                    multiline
                    numberOfLines={4}
                  />
                  <View style={styles.editActions}>
                    <Button
                      mode="text"
                      compact
                      onPress={() => setEditingField(null)}
                      textColor={theme.colors.onSurfaceVariant}
                    >
                      Cancel
                    </Button>
                    <Button
                      mode="contained"
                      compact
                      onPress={saveEdit}
                      loading={updateMutation.isPending}
                      disabled={updateMutation.isPending}
                    >
                      Save
                    </Button>
                  </View>
                </View>
              ) : (
                <Text
                  variant="bodyMedium"
                  style={{ color: idea.description ? theme.colors.onSurface : theme.colors.onSurfaceVariant }}
                >
                  {idea.description ?? "No description yet."}
                </Text>
              )}
            </Card.Content>
          </Card>

          {/* Stage Selector */}
          <Card mode="outlined" style={styles.card}>
            <Card.Title title="Stage" titleVariant="titleSmall" />
            <Card.Content style={styles.stageRow}>
              {STAGES.map((stage) => (
                <Chip
                  key={stage}
                  selected={idea.stage === stage}
                  onPress={() =>
                    idea.stage !== stage ? stageMutation.mutate(stage) : undefined
                  }
                  compact
                  disabled={stageMutation.isPending}
                >
                  {stage.charAt(0).toUpperCase() + stage.slice(1)}
                </Chip>
              ))}
            </Card.Content>
          </Card>

          {/* Notes preview */}
          {recentNotes.length > 0 && (
            <Card mode="outlined" style={styles.card}>
              <Card.Title title="Recent Notes" titleVariant="titleSmall" />
              <Card.Content>
                {recentNotes.map((note, idx) => (
                  <View key={note.id}>
                    {idx > 0 && <Divider style={{ marginVertical: 8 }} />}
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>
                      {note.body}
                    </Text>
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}

          {/* Links */}
          {idea.links && idea.links.length > 0 && (
            <Card mode="outlined" style={styles.card}>
              <Card.Title title="Links" titleVariant="titleSmall" />
              <Card.Content>
                {idea.links.map((link, idx: number) => (
                  <View key={link.id ?? idx}>
                    {idx > 0 && <Divider style={{ marginVertical: 6 }} />}
                    <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
                      {link.url}
                    </Text>
                    {link.label && (
                      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {link.label}
                      </Text>
                    )}
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}

          {/* Promotion info */}
          {idea.promotedAt && (
            <Card mode="outlined" style={styles.card}>
              <Card.Content>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Promoted to {idea.promotedToType} on {new Date(idea.promotedAt).toLocaleDateString()}
                </Text>
              </Card.Content>
            </Card>
          )}

          {/* Sections navigation */}
          <Card mode="outlined" style={styles.card}>
            <Card.Title title="Sections" titleVariant="titleSmall" />
            <Divider />
            {[
              { label: "Notes", icon: "notebook-outline", route: "notes" },
              { label: "Comments", icon: "comment-multiple-outline", route: "comments" },
              { label: "Canvas", icon: "vector-square", route: "canvas" },
              { label: "Activity", icon: "timeline-outline", route: "activity" },
            ].map(({ label, icon, route }) => (
              <List.Item
                key={route}
                title={label}
                left={(props) => <List.Icon {...props} icon={icon} />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => router.push(`/ideas/${id}/${route}` as Parameters<typeof router.push>[0])}
              />
            ))}
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: 8, paddingTop: 4 },
  content: { padding: 16, gap: 12 },
  card: {},
  fieldRow: { flexDirection: "row", alignItems: "flex-start" },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  pillRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" },
  stageRow: { flexDirection: "row", gap: 8 },
});
