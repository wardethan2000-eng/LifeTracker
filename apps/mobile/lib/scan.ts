const assetTagPattern = /^LK-[A-Z0-9]{8,}$/;
const cuidPattern = /^cl[a-z0-9]{20,}$/i;
// Inventory item scan tags: "inv_" prefix + alphanumeric
const inventoryTagPattern = /^inv_[a-z0-9]{6,}$/i;
// Space scan tags: "sp_" prefix + alphanumeric
const spaceTagPattern = /^sp_[a-z0-9]{6,}$/i;

export type AssetScanTarget =
  | { kind: "asset-tag"; tag: string }
  | { kind: "asset-id"; assetId: string };

export type InventoryOrSpaceScanTarget =
  | { kind: "inventory-tag"; tag: string }
  | { kind: "space-tag"; tag: string }
  | { kind: "generic-tag"; tag: string };

const normalizeAssetTag = (value: string): string | null => {
  const normalized = value.trim().toUpperCase();
  return assetTagPattern.test(normalized) ? normalized : null;
};

export const resolveAssetScanTarget = (value: string): AssetScanTarget | null => {
  const trimmed = value.trim();
  const tag = normalizeAssetTag(trimmed);

  if (tag) {
    return { kind: "asset-tag", tag };
  }

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    const scanMatch = pathname.match(/^\/scan\/([^/]+)$/i);

    if (scanMatch && scanMatch[1]) {
      const scanTag = normalizeAssetTag(decodeURIComponent(scanMatch[1]));

      if (scanTag) {
        return { kind: "asset-tag", tag: scanTag };
      }
    }

    const assetMatch = pathname.match(/^\/assets\/([^/]+)$/i);

    if (assetMatch && assetMatch[1] && cuidPattern.test(assetMatch[1])) {
      return { kind: "asset-id", assetId: assetMatch[1] };
    }
  } catch {
    return null;
  }

  return null;
};

/**
 * Extracts an inventory item or space scan tag from a raw scan value.
 * Returns the tag string (to pass to /v1/scan/resolve) or null if not recognized.
 */
export const resolveInventoryOrSpaceScanTag = (value: string): string | null => {
  const trimmed = value.trim();

  // Direct scan tag patterns
  if (inventoryTagPattern.test(trimmed) || spaceTagPattern.test(trimmed)) {
    return trimmed;
  }

  // URL patterns: /scan/i/{tag} or /scan/s/{tag} or /inventory/{id}
  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, "");

    const inventoryScanMatch = pathname.match(/^\/scan\/i\/([^/]+)$/i);
    if (inventoryScanMatch?.[1]) return decodeURIComponent(inventoryScanMatch[1]);

    const spaceScanMatch = pathname.match(/^\/scan\/s\/([^/]+)$/i);
    if (spaceScanMatch?.[1]) return decodeURIComponent(spaceScanMatch[1]);

    const inventoryItemMatch = pathname.match(/^\/inventory\/([^/]+)$/i);
    if (inventoryItemMatch?.[1] && cuidPattern.test(inventoryItemMatch[1])) {
      return inventoryItemMatch[1];
    }

    const spaceMatch = pathname.match(/^\/inventory\/spaces\/([^/]+)$/i);
    if (spaceMatch?.[1] && cuidPattern.test(spaceMatch[1])) {
      return spaceMatch[1];
    }
  } catch {
    // not a URL
  }

  return null;
};