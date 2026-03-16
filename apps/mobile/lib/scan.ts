const assetTagPattern = /^LK-[A-Z0-9]{8,}$/;
const cuidPattern = /^cl[a-z0-9]{20,}$/i;

export type AssetScanTarget =
  | { kind: "asset-tag"; tag: string }
  | { kind: "asset-id"; assetId: string };

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