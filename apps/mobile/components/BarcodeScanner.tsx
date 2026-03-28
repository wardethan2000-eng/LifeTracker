import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type BarcodeScannerProps = {
  /** Called with the raw scanned value and format string */
  onScanValue: (value: string, format: string) => void;
  /** When true, ignore incoming scan events (e.g. while resolving) */
  paused?: boolean;
};

const SCAN_DEBOUNCE_MS = 2000;

export function BarcodeScanner({ onScanValue, paused = false }: BarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const lastScanRef = useRef<number>(0);

  const handleBarcodeScanned = useCallback(
    (result: { data: string; type: string }) => {
      if (paused) return;
      const now = Date.now();

      if (now - lastScanRef.current < SCAN_DEBOUNCE_MS) {
        return;
      }

      lastScanRef.current = now;
      onScanValue(result.data, result.type);
    },
    [onScanValue, paused]
  );

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Requesting camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>
          Camera access is needed for barcode scanning.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            "upc_a",
            "upc_e",
            "ean8",
            "ean13",
            "code128",
            "code39",
            "qr"
          ]
        }}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <View style={styles.overlay}>
        <View style={styles.scanRegion} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center"
  },
  text: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginHorizontal: 32,
    marginBottom: 16
  },
  button: {
    backgroundColor: "#0d9488",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)"
  },
  scanRegion: {
    width: 260,
    height: 260,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    borderRadius: 16,
    backgroundColor: "transparent"
  }
});
