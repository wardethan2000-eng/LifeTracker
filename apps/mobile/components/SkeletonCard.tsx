import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

interface SkeletonCardProps {
  lines?: number;
}

export function SkeletonCard({ lines = 2 }: SkeletonCardProps) {
  const theme = useTheme();
  const color = theme.colors.surfaceVariant;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
      <View style={[styles.line, styles.titleLine, { backgroundColor: color }]} />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <View
          key={i}
          style={[styles.line, { backgroundColor: color, width: i === lines - 2 ? "60%" : "80%" }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  line: {
    height: 14,
    borderRadius: 4,
    width: "90%",
  },
  titleLine: {
    height: 16,
    width: "70%",
  },
});
