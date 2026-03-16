import type { BarcodeLookupResult } from "@lifekeeper/types";
import type { JSX } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type ProductLookupScreenProps = {
  result: BarcodeLookupResult;
  onBack: () => void;
  onScanAgain: () => void;
};

export function ProductLookupScreen({ result, onBack, onScanAgain }: ProductLookupScreenProps): JSX.Element {
  const productLabel = result.productName ?? "Unmatched product code";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Product Barcode</Text>
        <Text style={styles.heading}>{productLabel}</Text>
        <Text style={styles.body}>
          {result.found
            ? "The barcode lookup returned a product match. The draft sections below show how this scan can prefill future inventory and maintenance flows in mobile."
            : "No catalog match was found. The barcode value is still captured so it can prefill a part number or SKU field."}
        </Text>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Scanned Code</Text>
          <Text style={styles.codeValue}>{result.barcode}</Text>
          <Text style={styles.codeMeta}>{result.barcodeFormat}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory Draft</Text>
          <Text style={styles.row}>Name: {result.productName ?? ""}</Text>
          <Text style={styles.row}>Manufacturer: {result.brand ?? ""}</Text>
          <Text style={styles.row}>Category: {result.category ?? ""}</Text>
          <Text style={styles.row}>Part Number / SKU: {result.barcode}</Text>
          <Text style={styles.row}>Description: {result.description ?? ""}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Maintenance Part Draft</Text>
          <Text style={styles.row}>Part Name: {result.productName ?? ""}</Text>
          <Text style={styles.row}>Part Number: {result.barcode}</Text>
          <Text style={styles.row}>Supplier Brand: {result.brand ?? ""}</Text>
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
  codeCard: {
    backgroundColor: "#14342b",
    borderRadius: 18,
    padding: 18,
    gap: 6
  },
  codeLabel: {
    color: "#9dc9b0",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1
  },
  codeValue: {
    color: "#f7f3ea",
    fontSize: 24,
    fontWeight: "800"
  },
  codeMeta: {
    color: "#d6ded8",
    fontSize: 14,
    textTransform: "uppercase"
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