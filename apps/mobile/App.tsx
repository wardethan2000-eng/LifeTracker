import { createAssetSchema } from "@lifekeeper/types";
import { useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ScanScreen } from "./screens/ScanScreen";

const exampleAsset = createAssetSchema.parse({
  householdId: "clkeeperhouse000000000001",
  name: "Primary Vehicle",
  category: "vehicle",
  visibility: "shared",
  customFields: {
    engine: "3.5L EcoBoost"
  }
});

export default function App() {
  const [showScanner, setShowScanner] = useState(false);

  if (showScanner) {
    return <ScanScreen onBack={() => setShowScanner(false)} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.kicker}>LifeKeeper</Text>
        <Text style={styles.heading}>Maintenance without fragmented apps.</Text>
        <Text style={styles.body}>
          Phase 1 mobile scaffolding is connected to the shared monorepo contracts.
        </Text>
        <Text style={styles.assetLabel}>{exampleAsset.name}</Text>
        <Text style={styles.assetMeta}>{exampleAsset.category} asset preset-ready</Text>
        <TouchableOpacity style={styles.scanButton} onPress={() => setShowScanner(true)}>
          <Text style={styles.scanButtonText}>Scan a Barcode</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f3efe5",
    justifyContent: "center",
    padding: 24
  },
  card: {
    borderRadius: 28,
    backgroundColor: "#14342b",
    padding: 24,
    gap: 12
  },
  kicker: {
    color: "#f2c66d",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1
  },
  heading: {
    color: "#f7f3ea",
    fontSize: 32,
    fontWeight: "800"
  },
  body: {
    color: "#d6ded8",
    fontSize: 16,
    lineHeight: 24
  },
  assetLabel: {
    marginTop: 8,
    color: "#f7f3ea",
    fontSize: 20,
    fontWeight: "700"
  },
  assetMeta: {
    color: "#9dc9b0",
    fontSize: 14,
    textTransform: "capitalize"
  },
  scanButton: {
    marginTop: 12,
    backgroundColor: "#0d9488",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center"
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  }
});
