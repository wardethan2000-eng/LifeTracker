import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Chip, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { getMe, createHobby } from "../../lib/api";

type HobbyStatus = "active" | "paused";
type ActivityMode = "session" | "project" | "practice" | "collection";

const STATUS_OPTIONS: { value: HobbyStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

const MODE_OPTIONS: { value: ActivityMode; label: string }[] = [
  { value: "session", label: "Sessions" },
  { value: "practice", label: "Practice" },
  { value: "project", label: "Projects" },
  { value: "collection", label: "Collection" },
];

export default function CreateHobbyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hobbyType, setHobbyType] = useState("");
  const [status, setStatus] = useState<HobbyStatus>("active");
  const [activityMode, setActivityMode] = useState<ActivityMode>("session");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = me?.households[0]?.id ?? "";

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: async () => {
      if (!householdId || !name.trim()) throw new Error("Name is required.");
      return createHobby(householdId, {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        activityMode,
        hobbyType: hobbyType.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: (hobby) => {
      queryClient.invalidateQueries({ queryKey: ["hobbies", householdId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/hobbies/${hobby.id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
            Hobbies
          </Button>
          <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
            New Hobby
          </Text>
        </View>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <TextInput
              label="Hobby name *"
              value={name}
              onChangeText={setName}
              mode="outlined"
              placeholder="e.g. Road Cycling"
              autoFocus
              style={styles.input}
            />
            <TextInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="A brief description…"
              style={styles.input}
            />
            <TextInput
              label="Type / discipline"
              value={hobbyType}
              onChangeText={setHobbyType}
              mode="outlined"
              placeholder="e.g. Road / Mountain (optional)"
              style={styles.input}
            />

            <Text variant="labelMedium" style={{ color: theme.colors.onSurface, marginBottom: 6 }}>
              Status
            </Text>
            <View style={styles.chipRow}>
              {STATUS_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  selected={status === opt.value}
                  onPress={() => setStatus(opt.value)}
                  compact
                >
                  {opt.label}
                </Chip>
              ))}
            </View>

            <Text variant="labelMedium" style={{ color: theme.colors.onSurface, marginBottom: 6 }}>
              Activity mode
            </Text>
            <View style={styles.chipRow}>
              {MODE_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  selected={activityMode === opt.value}
                  onPress={() => setActivityMode(opt.value)}
                  compact
                >
                  {opt.label}
                </Chip>
              ))}
            </View>

            <TextInput
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="Any notes…"
              style={styles.input}
            />

            {error && (
              <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }}>
                {error}
              </Text>
            )}

            <View style={styles.actions}>
              <Button mode="text" onPress={() => router.back()}>Cancel</Button>
              <Button
                mode="contained"
                onPress={() => create()}
                loading={creating}
                disabled={creating || !name.trim()}
              >
                Create hobby
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  header: { marginBottom: 4 },
  backBtn: { alignSelf: "flex-start", marginLeft: -8, marginBottom: 4 },
  card: {},
  cardContent: { gap: 8, paddingBottom: 8 },
  input: { marginBottom: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
});
