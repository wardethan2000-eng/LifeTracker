import { createAssetSchema, devFixtureIds, type AssetDetailResponse, type BarcodeLookupResult } from "@lifekeeper/types";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getAssetDetailMobile, lookupAssetByTagMobile, lookupBarcodeMobile } from "./lib/api";
import { type AssetScanTarget } from "./lib/scan";
import { AssetDetailStubScreen } from "./screens/AssetDetailStubScreen";
import { ProductLookupScreen } from "./screens/ProductLookupScreen";
import { ScanScreen } from "./screens/ScanScreen";

const exampleAsset = createAssetSchema.parse({
  householdId: devFixtureIds.householdId,
  name: "Primary Vehicle",
  category: "vehicle",
  visibility: "shared",
  customFields: {
    engine: "3.5L EcoBoost"
  }
});

export default function App() {
  const [screen, setScreen] = useState<"home" | "scanner" | "loading" | "asset" | "product">("home");
  const [assetDetail, setAssetDetail] = useState<AssetDetailResponse | null>(null);
  const [barcodeResult, setBarcodeResult] = useState<BarcodeLookupResult | null>(null);

  const returnHome = useCallback(() => {
    setAssetDetail(null);
    setBarcodeResult(null);
    setScreen("home");
  }, []);

  const openScanner = useCallback(() => {
    setAssetDetail(null);
    setBarcodeResult(null);
    setScreen("scanner");
  }, []);

  const handleAssetScan = useCallback(async (target: AssetScanTarget) => {
    setScreen("loading");

    try {
      const detail = target.kind === "asset-id"
        ? await getAssetDetailMobile(target.assetId)
        : await lookupAssetByTagMobile(target.tag).then((asset) => getAssetDetailMobile(asset.id));

      setAssetDetail(detail);
      setScreen("asset");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The scanned asset could not be loaded.";
      setAssetDetail(null);
      setBarcodeResult(null);
      setScreen("home");
      Alert.alert("Asset Lookup Failed", message);
    }
  }, []);

  const handleProductScan = useCallback(async (data: { barcode: string; format: string }) => {
    setScreen("loading");

    try {
      const result = await lookupBarcodeMobile(data.barcode, data.format);
      setBarcodeResult(result);
      setScreen("product");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The scanned barcode could not be resolved.";
      setAssetDetail(null);
      setBarcodeResult(null);
      setScreen("home");
      Alert.alert("Barcode Lookup Failed", message);
    }
  }, []);

  if (screen === "scanner") {
    return <ScanScreen onBack={returnHome} onAssetScan={handleAssetScan} onProductScan={handleProductScan} />;
  }

  if (screen === "loading") {
    return (
      <SafeAreaView style={styles.loadingSafeArea}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={styles.loadingHeading}>Resolving Scan</Text>
          <Text style={styles.loadingBody}>Fetching the matching asset or product record from the API.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === "asset" && assetDetail) {
    return <AssetDetailStubScreen detail={assetDetail} onBack={returnHome} onScanAgain={openScanner} />;
  }

  if (screen === "product" && barcodeResult) {
    return <ProductLookupScreen result={barcodeResult} onBack={returnHome} onScanAgain={openScanner} />;
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
        <TouchableOpacity style={styles.scanButton} onPress={openScanner}>
          <Text style={styles.scanButtonText}>Scan Code</Text>
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
  },
  loadingSafeArea: {
    flex: 1,
    backgroundColor: "#f3efe5",
    justifyContent: "center",
    padding: 24
  },
  loadingCard: {
    borderRadius: 28,
    backgroundColor: "#fffaf2",
    padding: 24,
    gap: 12,
    alignItems: "center"
  },
  loadingHeading: {
    color: "#14342b",
    fontSize: 24,
    fontWeight: "800"
  },
  loadingBody: {
    color: "#35554a",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  }
});
