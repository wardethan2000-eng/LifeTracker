import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Dialog, Divider, Portal, Text, useTheme } from "react-native-paper";
import { useOfflineSync } from "../hooks/useOfflineSync";

/**
 * A slim banner that appears at the top of screens when there are mutations
 * pending sync or failures in the offline queue.
 *
 * Shows:
 *  - "X changes waiting to sync" (amber) when pending > 0
 *  - "X changes failed — tap to review" (red, tappable) when failed > 0
 *
 * When tapped with failures, opens a dialog listing each failed mutation
 * with Retry and Discard actions.
 */
export function OfflineBanner() {
  const { isOnline, pendingCount, failedCount, failedMutations, retry, discard, isFlushing } =
    useOfflineSync();
  const theme = useTheme();
  const [dialogVisible, setDialogVisible] = useState(false);

  if (pendingCount === 0 && failedCount === 0) return null;

  const hasFailed = failedCount > 0;
  const bgColor = hasFailed ? theme.colors.errorContainer : "#fef9c3";
  const textColor = hasFailed ? theme.colors.onErrorContainer : "#713f12";

  let message: string;
  if (isFlushing) {
    message = "Syncing changes…";
  } else if (hasFailed) {
    message = `${failedCount} change${failedCount !== 1 ? "s" : ""} failed — tap to review`;
  } else {
    message = `${pendingCount} change${pendingCount !== 1 ? "s" : ""} waiting to sync`;
  }

  return (
    <>
      <Pressable
        onPress={() => hasFailed && setDialogVisible(true)}
        style={[styles.banner, { backgroundColor: bgColor }]}
        accessible
        accessibilityRole={hasFailed ? "button" : "text"}
        accessibilityLabel={message}
      >
        <Text variant="labelSmall" style={[styles.text, { color: textColor }]}>
          {isOnline ? "" : "Offline · "}
          {message}
        </Text>
      </Pressable>

      <Portal>
        <Dialog
          visible={dialogVisible}
          onDismiss={() => setDialogVisible(false)}
          style={{ maxHeight: "70%" }}
        >
          <Dialog.Title>Failed Changes</Dialog.Title>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
            <ScrollView>
              {failedMutations.length === 0 ? (
                <Text
                  variant="bodyMedium"
                  style={{ padding: 16, color: theme.colors.onSurface }}
                >
                  No failed changes.
                </Text>
              ) : (
                failedMutations.map((m, i) => (
                  <View key={m.id}>
                    {i > 0 && <Divider />}
                    <View style={styles.mutationRow}>
                      <View style={styles.mutationInfo}>
                        <Text
                          variant="labelMedium"
                          style={{ color: theme.colors.onSurface, fontWeight: "600" }}
                        >
                          {m.description ?? `${m.method} ${m.entityType}`}
                        </Text>
                        <Text
                          variant="bodySmall"
                          style={{ color: theme.colors.onSurfaceVariant }}
                          numberOfLines={1}
                        >
                          {m.path}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          {m.retryCount} retries · {new Date(m.timestamp).toLocaleTimeString()}
                        </Text>
                      </View>
                      <View style={styles.mutationActions}>
                        <Button
                          mode="text"
                          compact
                          textColor={theme.colors.primary}
                          onPress={() => {
                            retry(m.id);
                            if (failedMutations.length <= 1) setDialogVisible(false);
                          }}
                        >
                          Retry
                        </Button>
                        <Button
                          mode="text"
                          compact
                          textColor={theme.colors.error}
                          onPress={() => {
                            discard(m.id);
                            if (failedMutations.length <= 1) setDialogVisible(false);
                          }}
                        >
                          Discard
                        </Button>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  text: {
    fontWeight: "600",
  },
  mutationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  mutationInfo: {
    flex: 1,
    gap: 2,
  },
  mutationActions: {
    flexDirection: "row",
    alignItems: "center",
  },
});
