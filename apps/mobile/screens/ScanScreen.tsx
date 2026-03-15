import { useCallback } from "react";
import { Alert, View } from "react-native";
import { BarcodeScanner } from "../components/BarcodeScanner";

type ScanScreenProps = {
  onBack: () => void;
};

export function ScanScreen({ onBack }: ScanScreenProps) {
  const handleScan = useCallback(
    (data: { barcode: string; format: string }) => {
      console.log("Scanned barcode:", data);
      Alert.alert(
        "Barcode Scanned",
        `Data: ${data.barcode}\nFormat: ${data.format}`,
        [
          { text: "Scan Again", style: "cancel" },
          { text: "Done", onPress: onBack }
        ]
      );
    },
    [onBack]
  );

  return (
    <View style={{ flex: 1 }}>
      <BarcodeScanner onScan={handleScan} />
    </View>
  );
}
