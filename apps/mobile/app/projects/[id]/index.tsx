import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Divider,
  List,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getProjectDetail } from "../../../lib/api";
import { EmptyState } from "../../../components/EmptyState";
import { StatusPill } from "../../../components/StatusPill";

export default function ProjectDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", householdId, id],
    queryFn: () => getProjectDetail(householdId, id!),
    enabled: !!householdId && !!id,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator style={styles.loader} size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !project) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <EmptyState icon="⚠️" title="Couldn't load project" />
      </SafeAreaView>
    );
  }

  const completedTasks = project.tasks.filter((t) => t.isCompleted).length;
  const totalTasks = project.tasks.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Button
          icon="arrow-left"
          mode="text"
          onPress={() => router.back()}
          style={styles.backBtn}
          labelStyle={{ color: theme.colors.onSurfaceVariant }}
        >
          Projects
        </Button>

        {/* Header */}
        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <View style={styles.titleRow}>
              <Text
                variant="headlineSmall"
                style={{ flex: 1, color: theme.colors.onSurface }}
                numberOfLines={2}
              >
                {project.name}
              </Text>
              <StatusPill status={project.status} />
            </View>
            {project.description && (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
              >
                {project.description}
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.stat, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
            <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
              {completedTasks}/{totalTasks}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Tasks</Text>
          </View>
          {project.budgetAmount !== null && (
            <View style={[styles.stat, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                ${project.budgetAmount.toFixed(0)}
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Budget</Text>
            </View>
          )}
          {project.phases.length > 0 && (
            <View style={[styles.stat, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
              <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
                {project.phases.length}
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Phases</Text>
            </View>
          )}
        </View>

        {/* Navigation */}
        <Card mode="outlined" style={styles.card}>
          <Divider />
          {[
            { label: "Tasks", icon: "checkbox-marked-outline", route: "tasks" },
            { label: "Notes", icon: "notebook-outline", route: "notes" },
          ].map(({ label, icon, route }) => (
            <List.Item
              key={route}
              title={label}
              left={(props) => <List.Icon {...props} icon={icon} color={theme.colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push(`/projects/${id}/${route}`)}
            />
          ))}
        </Card>

        {/* Phases summary */}
        {project.phases.length > 0 && (
          <Card mode="outlined" style={styles.card}>
            <Card.Title title="Phases" titleVariant="titleSmall" />
            <Card.Content>
              {project.phases.map((phase) => (
                <View key={phase.id} style={styles.phaseRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                      {phase.name}
                    </Text>
                  </View>
                  <StatusPill status={phase.status ?? "planning"} />
                </View>
              ))}
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  backBtn: { alignSelf: "flex-start", marginBottom: 4, marginLeft: -8 },
  card: {},
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
  },
  phaseRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
});
