import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { resolveAssetScanTarget, type AssetScanTarget } from "../lib/scan";

type ScanScreenProps = {
  onBack: () => void;
  onAssetScan: (target: AssetScanTarget) => Promise<void>;
  onProductScan: (data: { barcode: string; format: string }) => Promise<void>;
};

export function ScanScreen({ onBack, onAssetScan, onProductScan }: ScanScreenProps) {
  const [status, setStatus] = useState<string>("Align an asset label, QR code, or product barcode inside the frame.");
  const [isHandlingScan, setIsHandlingScan] = useState(false);

  const handleScan = useCallback(
    async (data: { barcode: string; format: string }) => {
      if (isHandlingScan) {
        return;
      }

      console.log("Scanned barcode:", data);

      const assetTarget = resolveAssetScanTarget(data.barcode);
      setIsHandlingScan(true);

      if (assetTarget) {
        setStatus(`Opening asset flow for ${data.barcode.trim()}...`);

        try {
          await onAssetScan(assetTarget);
        } catch (error) {
          Alert.alert(
            "Unable to Resolve Asset",
            error instanceof Error ? error.message : "The scanned asset could not be resolved.",
            [
              { text: "Scan Again", style: "cancel" },
              { text: "Back", onPress: onBack }
            ]
          );
          setStatus("Align an asset label, QR code, or product barcode inside the frame.");
          setIsHandlingScan(false);
        }

        return;
      }

      setStatus("Looking up product barcode...");

      try {
        await onProductScan(data);
      } catch (error) {
        Alert.alert(
          "Barcode Lookup Failed",
          error instanceof Error ? error.message : "The scanned barcode could not be resolved.",
          [
            { text: "Scan Again", style: "cancel" },
            { text: "Back", onPress: onBack }
          ]
        );
        setStatus("Align an asset label, QR code, or product barcode inside the frame.");
        setIsHandlingScan(false);
      }
    },
    [isHandlingScan, onAssetScan, onBack, onProductScan]
  );

  return (
    <View style={styles.container}>
      <BarcodeScanner onScan={handleScan} />
      <View style={styles.footer}>
        <Text style={styles.status}>{status}</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000"
  },
  footer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(20, 52, 43, 0.88)"
  },
  status: {
    color: "#f7f3ea",
    fontSize: 14,
    lineHeight: 20
  },
  backButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#0d9488"
  },
  backButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600"
  }
});
