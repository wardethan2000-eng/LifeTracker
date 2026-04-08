import type { PrismaClient } from "@prisma/client";
import type { BarcodeLookupResult } from "@aegis/types";

const UPC_EAN_LENGTHS = new Set([8, 12, 13, 14]);
const ALL_DIGITS = /^\d+$/;

type UpcItemDbItem = {
  title?: string;
  brand?: string;
  description?: string;
  category?: string;
};

type UpcItemDbResponse = {
  items?: UpcItemDbItem[];
};

async function lookupUpcItemDb(barcode: string): Promise<{ item: UpcItemDbItem; raw: unknown } | null> {
  const apiKey = process.env.UPCITEMDB_API_KEY;
  const baseUrl = apiKey
    ? "https://api.upcitemdb.com/prod/v1/lookup"
    : "https://api.upcitemdb.com/prod/trial/lookup";

  const url = `${baseUrl}?upc=${encodeURIComponent(barcode)}`;
  const headers: Record<string, string> = { Accept: "application/json" };

  if (apiKey) {
    headers["user_key"] = apiKey;
  }

  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as UpcItemDbResponse;

    if (!data.items || data.items.length === 0) {
      return null;
    }

    const firstItem = data.items[0];

    if (!firstItem) {
      return null;
    }

    return { item: firstItem, raw: data };
  } catch {
    return null;
  }
}

export function detectBarcodeFormat(barcode: string, hintFormat?: string): string {
  if (hintFormat) {
    return hintFormat;
  }

  if (!ALL_DIGITS.test(barcode)) {
    return "unknown";
  }

  switch (barcode.length) {
    case 8:
      return "EAN-8";
    case 12:
      return "UPC-A";
    case 13:
      return "EAN-13";
    case 14:
      return "GTIN-14";
    default:
      return "unknown";
  }
}

export async function resolveBarcode(
  prisma: PrismaClient,
  barcode: string,
  barcodeFormat?: string
): Promise<BarcodeLookupResult> {
  const format = detectBarcodeFormat(barcode, barcodeFormat);

  const cached = await prisma.barcodeLookup.findUnique({ where: { barcode } });

  if (cached) {
    // Fire-and-forget increment
    prisma.barcodeLookup.update({
      where: { id: cached.id },
      data: { lookupCount: { increment: 1 } }
    }).catch(() => {});

    return {
      barcode: cached.barcode,
      barcodeFormat: cached.barcodeFormat,
      found: true,
      productName: cached.productName,
      brand: cached.brand,
      description: cached.description,
      category: cached.category,
      imageUrl: cached.imageUrl,
      cachedAt: cached.createdAt.toISOString()
    };
  }

  const isUpcEan = ALL_DIGITS.test(barcode) && UPC_EAN_LENGTHS.has(barcode.length);

  if (!isUpcEan) {
    return {
      barcode,
      barcodeFormat: format,
      found: false,
      productName: null,
      brand: null,
      description: null,
      category: null,
      imageUrl: null,
      cachedAt: null
    };
  }

  const result = await lookupUpcItemDb(barcode);

  if (!result) {
    return {
      barcode,
      barcodeFormat: format,
      found: false,
      productName: null,
      brand: null,
      description: null,
      category: null,
      imageUrl: null,
      cachedAt: null
    };
  }

  const record = await prisma.barcodeLookup.create({
    data: {
      barcode,
      barcodeFormat: format,
      productName: result.item.title ?? null,
      brand: result.item.brand ?? null,
      description: result.item.description ?? null,
      category: result.item.category ?? null,
      sourceProvider: "upcitemdb",
      rawResponse: result.raw as object
    }
  });

  return {
    barcode: record.barcode,
    barcodeFormat: record.barcodeFormat,
    found: true,
    productName: record.productName,
    brand: record.brand,
    description: record.description,
    category: record.category,
    imageUrl: record.imageUrl,
    cachedAt: record.createdAt.toISOString()
  };
}
