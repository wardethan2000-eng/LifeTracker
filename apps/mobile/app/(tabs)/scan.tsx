import { useCallback, useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { Button, Dialog, Divider, Portal, Text, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarcodeScanner } from "../../components/BarcodeScanner";
import { resolveAssetScanTarget } from "../../lib/scan";
import { lookupAssetByTagMobile, lookupBarcodeMobile, type BarcodeLookupResult } from "../../lib/api";

type ScanState = "scanning" | "resolving";

export default function ScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [state, setState] = useState<ScanState>("scanning");
  const [productResult, setProductResult] = useState<BarcodeLookupResult | null>(null);

  const handleScanValue = useCallback(
    async (value: string, format: string) => {
      if (state === "resolving") return;
      setState("resolving");

      try {
        // Try to resolve as Aegis asset QR/tag first
        const assetTarget = resolveAssetScanTarget(value);
        if (assetTarget) {
          const asset =
            assetTarget.kind === "asset-tag"
              ? await lookupAssetByTagMobile(assetTarget.tag)
              : { id: assetTarget.assetId };

          setState("scanning");
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
          setProductResult(result);
          setState("scanning");
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

      {/* Product barcode result dialog */}
      <Portal>
        <Dialog
          visible={!!productResult}
          onDismiss={() => setProductResult(null)}
        >
          <Dialog.Title>
            {productResult?.productName ?? productResult?.brand ?? "Unknown product"}
          </Dialog.Title>
          <Dialog.Content>
            {productResult?.brand ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                Brand: {productResult.brand}
              </Text>
            ) : null}
            {productResult?.category ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                Category: {productResult.category}
              </Text>
            ) : null}
            {productResult?.description ? (
              <>
                <Divider style={{ marginVertical: 8 }} />
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {productResult.description}
                </Text>
              </>
            ) : null}
            {!productResult?.found ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                No product data found for barcode {productResult?.barcode}.
              </Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            {productResult?.imageUrl ? (
              <Button onPress={() => productResult.imageUrl && Linking.openURL(productResult.imageUrl)}>
                View image
              </Button>
            ) : null}
            <Button onPress={() => setProductResult(null)}>Dismiss</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
