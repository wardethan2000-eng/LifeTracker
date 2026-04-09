import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { Text, useTheme } from "react-native-paper";
import type { EntryFlag } from "@aegis/types";

const FLAGS: { value: EntryFlag; label: string; icon: string }[] = [
  { value: "important", label: "Important", icon: "⭐" },
  { value: "actionable", label: "Actionable", icon: "✅" },
  { value: "tip", label: "Tip", icon: "💡" },
  { value: "warning", label: "Warning", icon: "⚠️" },
  { value: "pinned", label: "Pinned", icon: "📌" },
  { value: "resolved", label: "Resolved", icon: "✔️" },
];

interface FlagChipsProps {
  value: EntryFlag[];
  onChange: (flags: EntryFlag[]) => void;
}

export function FlagChips({ value, onChange }: FlagChipsProps) {
  const theme = useTheme();

  function toggle(flag: EntryFlag) {
    onChange(
      value.includes(flag) ? value.filter((f) => f !== flag) : [...value, flag]
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {FLAGS.map((f) => {
        const active = value.includes(f.value);
        return (
          <TouchableOpacity
            key={f.value}
            onPress={() => toggle(f.value)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? theme.colors.secondaryContainer : theme.colors.surfaceVariant,
                borderColor: active ? theme.colors.secondary : "transparent",
              },
            ]}
          >
            <Text style={styles.chipIcon}>{f.icon}</Text>
            <Text
              variant="labelSmall"
              style={{
                color: active ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant,
              }}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipIcon: { fontSize: 13 },
});
