/**
 * Read-only canvas viewer.
 * Renders nodes as absolutely-positioned boxes on a pannable/zoomable surface.
 * Uses ScrollView's built-in pinch-zoom (maximumZoomScale) for simplicity — no heavy libraries.
 */
import { Dimensions, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { TouchableOpacity } from "react-native";
import type { IdeaCanvasNode } from "@lifekeeper/types";
import { getCanvas, getMe } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";

const CANVAS_PADDING = 64;

/** Get the bounding box of all nodes so we can size the canvas surface. */
function getCanvasBounds(nodes: IdeaCanvasNode[]): {
  width: number;
  height: number;
  minX: number;
  minY: number;
} {
  if (!nodes.length) return { width: 800, height: 600, minX: 0, minY: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const w = node.width ?? 120;
    const h = node.height ?? 60;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  return {
    width: maxX - minX + CANVAS_PADDING * 2,
    height: maxY - minY + CANVAS_PADDING * 2,
    minX,
    minY,
  };
}

function CanvasNode({
  node,
  minX,
  minY,
}: {
  node: IdeaCanvasNode;
  minX: number;
  minY: number;
}) {
  const theme = useTheme();
  const x = (node.x ?? 0) - minX + CANVAS_PADDING;
  const y = (node.y ?? 0) - minY + CANVAS_PADDING;
  const w = node.width ?? 120;
  const h = node.height ?? 60;

  const isPill = node.shape === "pill";
  const isRounded = node.shape === "rounded";
  const borderRadius = isPill ? Math.min(w, h) / 2 : isRounded ? 12 : 4;

  const bgColor = node.color ?? theme.colors.primaryContainer;

  return (
    <View
      style={[
        styles.node,
        {
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius,
          backgroundColor: bgColor,
          borderColor: theme.colors.outline,
        },
      ]}
    >
      {node.label ? (
        <Text
          numberOfLines={3}
          style={[styles.nodeLabel, { color: theme.colors.onSurface }]}
        >
          {node.label}
        </Text>
      ) : null}
    </View>
  );
}

type Params = { id: string; householdId?: string; name?: string };

export default function CanvasViewerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id, householdId: paramHouseholdId, name } = useLocalSearchParams<Params>();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const householdId = paramHouseholdId ?? me?.households[0]?.id ?? "";

  const { data: canvas, isLoading, error } = useQuery({
    queryKey: ["canvas", householdId, id],
    queryFn: () => getCanvas(householdId, id!),
    enabled: !!householdId && !!id,
  });

  const { width: screenWidth } = Dimensions.get("window");

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !canvas) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <EmptyState icon="⚠️" title="Couldn't load canvas" body="Try again later." />
      </SafeAreaView>
    );
  }

  const { width: cw, height: ch, minX, minY } = getCanvasBounds(canvas.nodes);
  const initialScale = Math.min(screenWidth / cw, 1);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.outline }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: theme.colors.primary, fontSize: 15 }}>← Back</Text>
        </TouchableOpacity>
        <Text
          variant="titleMedium"
          style={{ flex: 1, color: theme.colors.onSurface, marginLeft: 8 }}
          numberOfLines={1}
        >
          {name ? decodeURIComponent(name) : canvas.name}
        </Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {canvas.nodes.length} nodes
        </Text>
      </View>

      {canvas.nodes.length === 0 ? (
        <EmptyState icon="🗺️" title="Empty canvas" body="No nodes have been added yet." />
      ) : (
        <ScrollView
          maximumZoomScale={4}
          minimumZoomScale={initialScale * 0.5}
          zoomScale={initialScale}
          contentContainerStyle={[styles.canvasSurface, { width: cw, height: ch }]}
          style={{ flex: 1, backgroundColor: theme.colors.surfaceVariant }}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bouncesZoom
          scrollEventThrottle={16}
        >
          {/* Edge labels (simplified — show count) */}
          {canvas.nodes.map((node: IdeaCanvasNode) => (
            <CanvasNode
              key={node.id}
              node={node}
              minX={minX}
              minY={minY}
            />
          ))}
        </ScrollView>
      )}

      {/* Layer list footer */}
      {canvas.layers.length > 1 && (
        <View style={[styles.layerBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline }]}>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Layers: {canvas.layers.map((l) => l.name).join(" · ")}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4, paddingRight: 0 },
  canvasSurface: { position: "relative" },
  node: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  nodeLabel: {
    fontSize: 11,
    textAlign: "center",
    fontWeight: "500",
  },
  layerBar: {
    padding: 10,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
