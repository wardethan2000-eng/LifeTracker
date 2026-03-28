import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { EmptyState } from "../../../components/EmptyState";

/** Photo gallery — attachment upload requires Phase 3 infrastructure. */
export default function AssetPhotosScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backBtn}>
          Asset
        </Button>
        <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
          Photos
        </Text>
      </View>
      <EmptyState
        icon="📸"
        title="No photos yet"
        body="Photo capture and upload is coming in Phase 3."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingBottom: 8 },
  backBtn: { alignSelf: "flex-start", marginLeft: -8, marginBottom: 4 },
});
