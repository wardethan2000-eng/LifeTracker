import type { AssetDetailResponse } from "@aegis/types";
import type { JSX } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type AssetDetailStubScreenProps = {
  detail: AssetDetailResponse;
  onBack: () => void;
  onScanAgain: () => void;
};

const describeAsset = (detail: AssetDetailResponse): string => {
  const parts = [detail.asset.manufacturer, detail.asset.model].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : (detail.asset.description ?? "No description provided.");
};

export function AssetDetailStubScreen({ detail, onBack, onScanAgain }: AssetDetailStubScreenProps): JSX.Element {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Scanned Asset</Text>
        <Text style={styles.heading}>{detail.asset.name}</Text>
        <Text style={styles.body}>{describeAsset(detail)}</Text>

        <View style={styles.tagRow}>
          <Text style={styles.tagLabel}>Asset Tag</Text>
          <Text style={styles.tagValue}>{detail.asset.assetTag}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Category</Text>
            <Text style={styles.statValue}>{detail.asset.category}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Due</Text>
            <Text style={styles.statValue}>{detail.dueScheduleCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Overdue</Text>
            <Text style={styles.statValue}>{detail.overdueScheduleCount}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.row}>Visibility: {detail.asset.visibility}</Text>
          <Text style={styles.row}>Serial: {detail.asset.serialNumber ?? "Not recorded"}</Text>
          <Text style={styles.row}>Children: {detail.asset.childAssets.length}</Text>
          <Text style={styles.row}>Recent Logs: {detail.recentLogs.length}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mobile Stub</Text>
          <Text style={styles.body}>
            This is the in-app asset handoff for scanned labels. It keeps the scan result in mobile instead of pushing the user into the browser.
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={onScanAgain}>
            <Text style={styles.primaryButtonText}>Scan Another</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
            <Text style={styles.secondaryButtonText}>Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f3efe5"
  },
  content: {
    padding: 24,
    gap: 18
  },
  kicker: {
    color: "#8a5f12",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1
  },
  heading: {
    color: "#14342b",
    fontSize: 30,
    fontWeight: "800"
  },
  body: {
    color: "#35554a",
    fontSize: 15,
    lineHeight: 22
  },
  tagRow: {
    backgroundColor: "#14342b",
    borderRadius: 18,
    padding: 18,
    gap: 6
  },
  tagLabel: {
    color: "#9dc9b0",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1
  },
  tagValue: {
    color: "#f7f3ea",
    fontSize: 24,
    fontWeight: "800"
  },
  statsRow: {
    flexDirection: "row",
    gap: 12
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fffaf2",
    borderRadius: 16,
    padding: 16,
    gap: 4
  },
  statLabel: {
    color: "#7d7463",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  statValue: {
    color: "#14342b",
    fontSize: 22,
    fontWeight: "800",
    textTransform: "capitalize"
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    gap: 8
  },
  sectionTitle: {
    color: "#14342b",
    fontSize: 18,
    fontWeight: "700"
  },
  row: {
    color: "#35554a",
    fontSize: 15
  },
  actions: {
    gap: 12,
    marginTop: 8
  },
  primaryButton: {
    backgroundColor: "#0d9488",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700"
  },
  secondaryButton: {
    borderColor: "#14342b",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#14342b",
    fontSize: 16,
    fontWeight: "700"
  }
});