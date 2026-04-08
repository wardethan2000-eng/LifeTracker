import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { Text, useTheme } from "react-native-paper";
import type { EntryType } from "@aegis/types";

const ENTRY_TYPES: { value: EntryType; label: string; icon: string }[] = [
  { value: "note", label: "Note", icon: "📝" },
  { value: "observation", label: "Observation", icon: "🔍" },
  { value: "measurement", label: "Measurement", icon: "📏" },
  { value: "lesson", label: "Lesson", icon: "💡" },
  { value: "decision", label: "Decision", icon: "⚖️" },
  { value: "issue", label: "Issue", icon: "⚠️" },
  { value: "milestone", label: "Milestone", icon: "🎯" },
  { value: "reference", label: "Reference", icon: "📎" },
  { value: "comparison", label: "Comparison", icon: "↔️" },
];

interface EntryTypeChipsProps {
  value: EntryType;
  onChange: (type: EntryType) => void;
}

export function EntryTypeChips({ value, onChange }: EntryTypeChipsProps) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {ENTRY_TYPES.map((t) => {
        const active = t.value === value;
        return (
          <TouchableOpacity
            key={t.value}
            onPress={() => onChange(t.value)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                borderColor: active ? theme.colors.primary : "transparent",
              },
            ]}
          >
            <Text style={styles.chipIcon}>{t.icon}</Text>
            <Text
              variant="labelSmall"
              style={{
                color: active ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant,
              }}
            >
              {t.label}
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
