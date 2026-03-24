import bwipjs from "bwip-js";

const FORMAT_MAP: Record<string, string> = {
  "UPC-A": "upca",
  "EAN-13": "ean13",
  "EAN-8": "ean8",
  "GTIN-14": "itf14"
};

/**
 * Maps a human-readable barcode format name (as returned by detectBarcodeFormat)
 * to the corresponding bwip-js bcid.  Unrecognised formats fall back to code128.
 */
export function mapBarcodeFormat(format: string): string {
  return FORMAT_MAP[format] ?? "code128";
}

export async function generateBarcodePng({
  value,
  format,
  scale = 2
}: {
  value: string;
  format: string;
  scale?: number;
}): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: mapBarcodeFormat(format),
    text: value,
    scale,
    includetext: true,
    textxalign: "center"
  });
}

export async function generateBarcodeSvg({
  value,
  format
}: {
  value: string;
  format: string;
}): Promise<string> {
  return bwipjs.toSVG({
    bcid: mapBarcodeFormat(format),
    text: value,
    includetext: true,
    textxalign: "center"
  });
}
