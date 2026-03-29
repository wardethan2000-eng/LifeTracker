import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { getMe, createIdea } from "../../lib/api";
import { useOfflineSync } from "../../hooks/useOfflineSync";
import { enqueueMutation } from "../../lib/offline-queue";

type Stage = "spark" | "developing" | "ready";
type Priority = "low" | "medium" | "high";

export default function NewIdeaScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<Stage>("spark");
  const [priority, setPriority] = useState<Priority>("medium");
  const [error, setError] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";
  const { isOnline } = useOfflineSync();

  const { mutate: create, isPending } = useMutation({
    mutationFn: () => {
      if (!householdId || !title.trim()) throw new Error("Title is required.");
      return createIdea(householdId, {
        title: title.trim(),
        description: description.trim() || undefined,
        stage,
        priority,
      });
    },
    onSuccess: (idea) => {
      queryClient.invalidateQueries({ queryKey: ["ideas", householdId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/ideas/${idea.id}`);
    },
    onError: (err: Error) => {
      if (!isOnline) {
        enqueueMutation({
          method: "POST",
          path: `/v1/households/${householdId}/ideas`,
          body: {
            title: title.trim(),
            description: description.trim() || undefined,
            stage,
            priority,
          },
          entityType: "ideas",
          description: `Create idea: ${title.trim()}`,
        });
        router.replace("/ideas");
      } else {
        setError(err.message);
      }
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
          Ideas
        </Button>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          variant="headlineSmall"
          style={[styles.heading, { color: theme.colors.onBackground }]}
        >
          New Idea
        </Text>

        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <TextInput
              label="Title"
              value={title}
              onChangeText={setTitle}
              autoFocus
              maxLength={200}
              style={styles.input}
            />
            <TextInput
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={2000}
              style={styles.input}
            />
          </Card.Content>
        </Card>

        <Text
          variant="labelMedium"
          style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
        >
          Stage
        </Text>
        <SegmentedButtons
          value={stage}
          onValueChange={(v) => setStage(v as Stage)}
          buttons={[
            { value: "spark", label: "Spark" },
            { value: "developing", label: "Developing" },
            { value: "ready", label: "Ready" },
          ]}
          style={styles.segment}
        />

        <Text
          variant="labelMedium"
          style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
        >
          Priority
        </Text>
        <SegmentedButtons
          value={priority}
          onValueChange={(v) => setPriority(v as Priority)}
          buttons={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ]}
          style={styles.segment}
        />

        {error && (
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.error, marginTop: 8 }}
          >
            {error}
          </Text>
        )}

        <Button
          mode="contained"
          onPress={() => {
            setError(null);
            create();
          }}
          loading={isPending}
          disabled={isPending || !title.trim()}
          style={styles.submit}
        >
          Save Idea
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: 8, paddingTop: 4 },
  content: { padding: 16, paddingBottom: 40 },
  heading: { marginBottom: 16, fontWeight: "600" },
  card: { marginBottom: 16 },
  input: { marginBottom: 12, backgroundColor: "transparent" },
  sectionLabel: { marginBottom: 8, marginTop: 4 },
  segment: { marginBottom: 16 },
  submit: { marginTop: 8 },
});
