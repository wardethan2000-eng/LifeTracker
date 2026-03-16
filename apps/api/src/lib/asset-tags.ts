import type { PrismaClient } from "@prisma/client";

const ASSET_TAG_PREFIX = "LK-";
const defaultAppBaseUrl = "http://127.0.0.1:3000";

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

export const resolveAppBaseUrl = (): string => trimTrailingSlashes(
  process.env.APP_BASE_URL?.trim()
  || process.env.WEB_BASE_URL?.trim()
  || defaultAppBaseUrl
);

export const buildAssetScanUrl = (assetTag: string): string => new URL(`/scan/${encodeURIComponent(assetTag)}`, `${resolveAppBaseUrl()}/`).toString();

export const deriveAssetTag = (assetId: string, tailLength = 8): string => {
  const normalizedLength = Math.min(Math.max(tailLength, 8), assetId.length);
  return `${ASSET_TAG_PREFIX}${assetId.slice(-normalizedLength).toUpperCase()}`;
};

export const ensureAssetTag = async (prisma: PrismaClient, assetId: string): Promise<string> => {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, assetTag: true }
  });

  if (!asset) {
    throw new Error(`Asset '${assetId}' was not found.`);
  }

  if (asset.assetTag) {
    return asset.assetTag;
  }

  for (const tailLength of [8, 10, 12, 14, 16, asset.id.length]) {
    const candidate = deriveAssetTag(asset.id, tailLength);
    const existing = await prisma.asset.findUnique({
      where: { assetTag: candidate },
      select: { id: true }
    });

    if (!existing || existing.id === asset.id) {
      await prisma.asset.update({
        where: { id: asset.id },
        data: { assetTag: candidate }
      });

      return candidate;
    }
  }

  throw new Error(`Unable to generate a unique asset tag for asset '${assetId}'.`);
};