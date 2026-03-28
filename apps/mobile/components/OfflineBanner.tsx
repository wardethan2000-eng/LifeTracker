import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useOfflineSync } from "../hooks/useOfflineSync";

/**
 * A slim banner that appears at the top of screens when there are mutations
 * pending sync or failures in the offline queue.
 *
 * Shows:
 *  - "X changes waiting to sync" (amber) when pending > 0
 *  - "X changes failed" (red) when failed > 0
 *  - Nothing when fully synced
 */
export function OfflineBanner() {
  const { isOnline, pendingCount, failedCount, isFlushing } = useOfflineSync();
  const theme = useTheme();

  if (pendingCount === 0 && failedCount === 0) return null;

  const hasFailed = failedCount > 0;
  const bgColor = hasFailed ? theme.colors.errorContainer : "#fef9c3"; // amber-50
  const textColor = hasFailed ? theme.colors.onErrorContainer : "#713f12"; // amber-900

  let message: string;
  if (isFlushing) {
    message = "Syncing changes…";
  } else if (hasFailed) {
    message = `${failedCount} change${failedCount !== 1 ? "s" : ""} failed to sync`;
  } else {
    message = `${pendingCount} change${pendingCount !== 1 ? "s" : ""} waiting to sync`;
  }

  return (
    <View style={[styles.banner, { backgroundColor: bgColor }]}>
      <Text variant="labelSmall" style={[styles.text, { color: textColor }]}>
        {isOnline ? "" : "Offline · "}{message}
      </Text>
    </View>
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
});
