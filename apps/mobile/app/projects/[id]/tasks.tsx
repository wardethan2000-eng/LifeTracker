import { Alert, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Checkbox,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, getProjectDetail, updateProjectTask } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";
import type { ProjectTask } from "../../../lib/api";
import { useOfflineSync } from "../../../hooks/useOfflineSync";
import { enqueueMutation } from "../../../lib/offline-queue";

export default function ProjectTasksScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";
  const { isOnline } = useOfflineSync();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", householdId, id],
    queryFn: () => getProjectDetail(householdId, id!),
    enabled: !!householdId && !!id,
  });

  const { mutate: toggleTask, isPending: toggling } = useMutation({
    mutationFn: (task: ProjectTask) =>
      updateProjectTask(householdId, id!, task.id, {
        isCompleted: !task.isCompleted,
        completedAt: !task.isCompleted ? new Date().toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", householdId, id] });
    },
    onError: (err: Error, task: ProjectTask) => {
      if (!isOnline) {
        enqueueMutation({
          method: "PATCH",
          path: `/v1/households/${householdId}/projects/${id}/tasks/${task.id}`,
          body: {
            isCompleted: !task.isCompleted,
            completedAt: !task.isCompleted ? new Date().toISOString() : null,
          },
          entityType: "project-tasks",
          entityId: task.id,
          description: `${!task.isCompleted ? "Complete" : "Reopen"} task: ${task.title}`,
        });
      } else {
        Alert.alert("Could not update task", err.message ?? "Please try again.");
      }
    },
  });

  // Group tasks by phase
  const phasesMap = new Map<string | null, ProjectTask[]>();
  if (project) {
    for (const task of project.tasks) {
      const key = task.phaseId ?? null;
      const existing = phasesMap.get(key) ?? [];
      existing.push(task);
      phasesMap.set(key, existing);
    }
  }

  const phaseNameMap = new Map(
    project?.phases.map((p) => [p.id, p.name]) ?? []
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator style={styles.loader} size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          icon="⚠️"
          title="Could not load tasks"
          body="Go back and try again."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
          Project
        </Button>
        <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
          Tasks
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!project || project.tasks.length === 0 ? (
          <EmptyState
            icon="✅"
            title="No tasks yet"
            body="Add tasks from the web dashboard."
          />
        ) : (
          Array.from(phasesMap.entries()).map(([phaseId, tasks]) => (
            <View key={phaseId ?? "ungrouped"}>
              {phaseId && (
                <Text
                  variant="labelLarge"
                  style={[styles.phaseHeader, { color: theme.colors.onSurfaceVariant }]}
                >
                  {phaseNameMap.get(phaseId) ?? "Phase"}
                </Text>
              )}
              <Card mode="outlined" style={styles.card}>
                <Card.Content style={styles.taskList}>
                  {tasks.map((task, idx) => (
                    <View key={task.id}>
                      {idx > 0 && <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />}
                      <View style={styles.taskRow}>
                        <Checkbox
                          status={task.isCompleted ? "checked" : "unchecked"}
                          onPress={() => toggleTask(task)}
                          disabled={toggling}
                          color={theme.colors.primary}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            variant="bodyMedium"
                            style={{
                              color: task.isCompleted
                                ? theme.colors.onSurfaceVariant
                                : theme.colors.onSurface,
                              textDecorationLine: task.isCompleted ? "line-through" : "none",
                            }}
                          >
                            {task.title}
                          </Text>
                          {task.assignee && (
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                              {task.assignee.displayName ?? task.assignee.id}
                            </Text>
                          )}
                          {task.dueDate && (
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                              Due {new Date(task.dueDate).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </Card.Content>
              </Card>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1 },
  header: { padding: 16, paddingBottom: 8 },
  backBtn: { alignSelf: "flex-start", marginLeft: -8, marginBottom: 4 },
  scroll: { padding: 16, paddingTop: 4 },
  card: { marginBottom: 12 },
  phaseHeader: { marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  taskList: { gap: 0 },
  taskRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 6 },
  divider: { height: 1, marginVertical: 2 },
});
