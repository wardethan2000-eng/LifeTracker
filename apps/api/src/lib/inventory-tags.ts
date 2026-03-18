import type { Prisma, PrismaClient } from "@prisma/client";
import { customAlphabet } from "nanoid";
import { resolveAppBaseUrl } from "./asset-tags.js";

const SCAN_TAG_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

const buildScanTagGenerator = (length: number) => customAlphabet(SCAN_TAG_ALPHABET, length);

export const generateInventoryItemScanTag = async (prisma: PrismaLike): Promise<string> => {
  for (const length of [10, 12, 14, 16]) {
    const createCandidate = buildScanTagGenerator(length);

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const candidate = `inv_${createCandidate()}`;
      const existing = await prisma.inventoryItem.findUnique({
        where: { scanTag: candidate },
        select: { id: true }
      });

      if (!existing) {
        return candidate;
      }
    }
  }

  throw new Error("Unable to generate a unique scan tag for the inventory item.");
};

export const ensureInventoryItemScanTag = async (prisma: PrismaLike, inventoryItemId: string): Promise<string> => {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: inventoryItemId },
    select: { id: true, scanTag: true }
  });

  if (!item) {
    throw new Error(`Inventory item '${inventoryItemId}' was not found.`);
  }

  if (item.scanTag) {
    return item.scanTag;
  }

  const scanTag = await generateInventoryItemScanTag(prisma);
  await prisma.inventoryItem.update({
    where: { id: inventoryItemId },
    data: { scanTag }
  });

  return scanTag;
};

export const buildInventoryItemScanUrl = (scanTag: string): string => new URL(
  `/scan/i/${encodeURIComponent(scanTag)}`,
  `${resolveAppBaseUrl()}/`
).toString();