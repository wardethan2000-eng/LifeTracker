import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarcodeScanner } from "../../components/BarcodeScanner";
import { resolveAssetScanTarget } from "../../lib/scan";
import { lookupAssetByTagMobile, lookupBarcodeMobile } from "../../lib/api";

type ScanState = "scanning" | "resolving";

export default function ScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [state, setState] = useState<ScanState>("scanning");

  const handleScanValue = useCallback(
    async (value: string, format: string) => {
      if (state === "resolving") return;
      setState("resolving");

      try {
        // Try to resolve as LifeKeeper asset QR/tag first
        const assetTarget = resolveAssetScanTarget(value);
        if (assetTarget) {
          const asset =
            assetTarget.kind === "asset-tag"
              ? await lookupAssetByTagMobile(assetTarget.tag)
              : { id: assetTarget.assetId };

          router.push(`/assets/${asset.id}`);
          return;
        }

        // Fall back to product barcode lookup
        const isProductBarcode = [
          "upc_a",
          "upc_e",
          "ean_8",
          "ean_13",
          "code_128",
          "code_39",
        ].includes(format.toLowerCase());

        if (isProductBarcode) {
          const result = await lookupBarcodeMobile(value, format);
          // Navigate to barcode result — Phase 1 will add a dedicated screen
          Alert.alert(
            result.productName ?? result.brand ?? "Unknown product",
            `Barcode: ${value}\n\nFull product detail screen coming in Phase 1.`,
            [{ text: "OK", onPress: () => setState("scanning") }]
          );
          return;
        }

        setState("scanning");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not resolve scan.";
        Alert.alert("Scan Failed", message, [
          { text: "OK", onPress: () => setState("scanning") },
        ]);
      }
    },
    [state, router]
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: "#000" }]}
      edges={["top"]}
    >
      <View style={styles.camera}>
        <BarcodeScanner
          onScanValue={handleScanValue}
          paused={state === "resolving"}
        />
      </View>
      {state === "resolving" && (
        <View
          style={[styles.resolving, { backgroundColor: theme.colors.primaryContainer }]}
        >
          <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer }}>
            Resolving…
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  resolving: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
});
