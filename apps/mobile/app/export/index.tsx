/**
 * Export screen — generate a PDF asset report and send to the OS share sheet.
 * Accessible via More → Export.
 */
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Divider,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useQuery } from "@tanstack/react-query";
import { getMe, getHouseholdAssets, type Asset } from "../../lib/api";

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

function buildHtml(assets: Asset[]): string {
  const generatedAt = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const rows = assets
    .map(
      (a) => `
      <tr>
        <td>${a.name}</td>
        <td><span class="badge">${a.assetTypeLabel ?? a.category}</span></td>
        <td>${a.manufacturer ?? "—"}</td>
        <td>${a.model ?? "—"}</td>
        <td>${a.conditionScore !== null && a.conditionScore !== undefined ? `${a.conditionScore}/10` : "—"}</td>
        <td>${a.spaceLocation?.name ?? "—"}</td>
      </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 32px; color: #1a1a1a; }
    h1 { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
    .subtitle { font-size: 13px; color: #666; margin-bottom: 28px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead tr { background: #f4f4f4; }
    th {
      padding: 9px 12px; text-align: left;
      font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.04em;
      color: #555; border-bottom: 2px solid #e0e0e0;
    }
    td { padding: 8px 12px; border-bottom: 1px solid #ececec; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .badge {
      display: inline-block; padding: 2px 8px;
      border-radius: 10px; font-size: 11px;
      background: #e8e8e8; color: #444;
    }
    .footer { margin-top: 24px; font-size: 11px; color: #999; }
    .count { font-size: 13px; color: #555; margin-bottom: 16px; }
  </style>
</head>
<body>
  <h1>Asset Report</h1>
  <p class="subtitle">Generated ${generatedAt}</p>
  <p class="count">${assets.length} asset${assets.length !== 1 ? "s" : ""}</p>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Type / Category</th>
        <th>Manufacturer</th>
        <th>Model</th>
        <th>Condition</th>
        <th>Location</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <p class="footer">Aegis — household asset report</p>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ExportScreen() {
  const theme = useTheme();
  const [generating, setGenerating] = useState(false);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });
  const householdId = me?.households[0]?.id ?? "";

  const { data: assetsPage, isLoading: assetsLoading } = useQuery({
    queryKey: ["export-assets", householdId],
    queryFn: () => getHouseholdAssets(householdId, { limit: 200 }),
    enabled: !!householdId,
  });

  const assets = assetsPage?.items ?? [];
  const loading = meLoading || assetsLoading;

  async function handleExportPdf() {
    if (assets.length === 0) {
      Alert.alert("No assets", "Add some assets before exporting.");
      return;
    }
    setGenerating(true);
    try {
      const html = buildHtml(assets);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Sharing unavailable", "Your device does not support sharing files.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Asset Report",
        UTI: "com.adobe.pdf",
      });
    } catch (err) {
      Alert.alert("Export failed", err instanceof Error ? err.message : "Could not generate PDF.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
            Export
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
            Download or share your data
          </Text>
        </View>

        {loading && <ActivityIndicator style={{ marginTop: 32 }} />}

        {!loading && (
          <>
            <Card mode="outlined" style={styles.card}>
              <Card.Content>
                <Text
                  variant="titleSmall"
                  style={{ color: theme.colors.onSurface, fontWeight: "600", marginBottom: 6 }}
                >
                  📄 Asset Report (PDF)
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16, lineHeight: 18 }}
                >
                  {`A printable summary of all ${assets.length} assets — name, type, manufacturer, model, condition, and location.`}
                </Text>
                <Divider style={{ marginBottom: 16 }} />
                <Button
                  mode="contained"
                  onPress={handleExportPdf}
                  loading={generating}
                  disabled={generating || assets.length === 0}
                  icon="file-pdf-box"
                >
                  {generating ? "Generating…" : "Export as PDF"}
                </Button>
              </Card.Content>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  header: { marginBottom: 4 },
  card: {},
});
