import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

type PillVariant =
  | "success"
  | "warning"
  | "info"
  | "muted"
  | "danger";

interface StatusPillProps {
  status: string;
  label?: string;
}

const VARIANT_MAP: Record<string, PillVariant> = {
  // Projects
  active: "success",
  on_hold: "warning",
  planning: "info",
  completed: "muted",
  cancelled: "danger",
  // Hobbies
  paused: "warning",
  archived: "muted",
  // Ideas
  spark: "warning",
  developing: "info",
  ready: "success",
  // Schedules
  due: "warning",
  overdue: "danger",
  upcoming: "info",
};

const VARIANT_STYLES: Record<PillVariant, { bg: string; text: string }> = {
  success: { bg: "#dcfce7", text: "#166534" },
  warning: { bg: "#fef9c3", text: "#854d0e" },
  info: { bg: "#dbeafe", text: "#1e40af" },
  muted: { bg: "#f3f4f6", text: "#374151" },
  danger: { bg: "#fee2e2", text: "#991b1b" },
};

export function StatusPill({ status, label }: StatusPillProps) {
  const variant = VARIANT_MAP[status] ?? "muted";
  const colors = VARIANT_STYLES[variant];
  const displayLabel = label ?? status.replace(/_/g, " ");

  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <Text variant="labelSmall" style={[styles.text, { color: colors.text }]}>
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  text: {
    textTransform: "capitalize",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
