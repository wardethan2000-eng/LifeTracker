import PDFDocument from "pdfkit";
import { generateBarcodePng } from "./barcode-image.js";
import { detectBarcodeFormat } from "./barcode-lookup.js";

type BarcodePrintableLabel = {
  value: string;
  format?: string | null;
  title: string;
  subtitle?: string | null;
};

type BarcodePreparedLabel = BarcodePrintableLabel & {
  barcodeImage: Buffer;
  resolvedFormat: string;
};

const points = (value: number): number => value * 72;

const prepareBarcodeLbels = async (labels: BarcodePrintableLabel[], scale: number): Promise<BarcodePreparedLabel[]> =>
  Promise.all(
    labels.map(async (label) => {
      const resolvedFormat = detectBarcodeFormat(label.value, label.format ?? undefined);
      const barcodeImage = await generateBarcodePng({ value: label.value, format: resolvedFormat, scale });
      return { ...label, barcodeImage, resolvedFormat };
    })
  );

const fitText = (
  doc: PDFKit.PDFDocument,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  fontName: string
): number => {
  let size = maxSize;

  while (size > minSize) {
    doc.font(fontName).fontSize(size);

    if (doc.widthOfString(text) <= maxWidth) {
      return size;
    }

    size -= 1;
  }

  return minSize;
};

const renderBarcodeLabelCard = (
  doc: PDFKit.PDFDocument,
  label: BarcodePreparedLabel,
  bounds: { x: number; y: number; width: number; height: number },
  options: { compact: boolean }
): void => {
  const padding = options.compact ? 6 : 18;
  const x = bounds.x + padding;
  const y = bounds.y + padding;
  const width = bounds.width - padding * 2;
  const height = bounds.height - padding * 2;

  doc.save();
  doc.roundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 8).lineWidth(0.75).stroke("#cbd5e1");

  // Barcode image — centered, occupying most of the horizontal space
  const barcodeMaxWidth = width;
  const barcodeMaxHeight = height * (options.compact ? 0.5 : 0.55);
  const barcodeW = Math.min(barcodeMaxWidth, options.compact ? 120 : 280);
  const barcodeH = Math.min(barcodeMaxHeight, barcodeW * 0.35);
  const barcodeX = bounds.x + (bounds.width - barcodeW) / 2;
  const barcodeY = y;

  doc.image(label.barcodeImage, barcodeX, barcodeY, { fit: [barcodeW, barcodeH], align: "center", valign: "center" });

  let textY = barcodeY + barcodeH + (options.compact ? 4 : 10);

  // Value text
  const valueSize = fitText(doc, label.value, width, options.compact ? 9 : 13, options.compact ? 6 : 9, "Helvetica-Bold");
  doc.font("Helvetica-Bold").fontSize(valueSize).fillColor("#0f172a");
  const valueHeight = doc.currentLineHeight();
  doc.text(label.value, x, textY, { width, align: "center", lineBreak: false });
  textY += valueHeight + (options.compact ? 2 : 6);

  // Title
  const titleSize = fitText(doc, label.title, width, options.compact ? 8 : 12, options.compact ? 6 : 8, "Helvetica");
  doc.font("Helvetica").fontSize(titleSize).fillColor("#334155");
  doc.text(label.title, x, textY, { width, align: "center", lineBreak: false, ellipsis: true });

  if (label.subtitle) {
    const subtitleHeight = doc.currentLineHeight();
    textY += subtitleHeight + (options.compact ? 2 : 4);

    const subtitleSize = fitText(doc, label.subtitle, width, options.compact ? 7 : 10, options.compact ? 5 : 7, "Helvetica");
    doc.font("Helvetica").fontSize(subtitleSize).fillColor("#64748b");
    doc.text(label.subtitle, x, textY, { width, align: "center", lineBreak: false, ellipsis: true });
  }

  doc.restore();
};

export const createSingleBarcodeLabelPdf = async (label: BarcodePrintableLabel): Promise<PDFKit.PDFDocument> => {
  const [prepared] = await prepareBarcodeLbels([label], 4);

  if (!prepared) {
    throw new Error("Barcode label preparation failed.");
  }

  const doc = new PDFDocument({ size: [points(4), points(2)], margin: 0, autoFirstPage: true });

  renderBarcodeLabelCard(doc, prepared, {
    x: points(0.2),
    y: points(0.15),
    width: points(3.6),
    height: points(1.7)
  }, { compact: false });

  return doc;
};

export const createBatchBarcodeLabelPdf = async (labels: BarcodePrintableLabel[]): Promise<PDFKit.PDFDocument> => {
  const prepared = await prepareBarcodeLbels(labels, 3);
  const doc = new PDFDocument({ size: "LETTER", margin: 0, autoFirstPage: false });
  const pageWidth = points(8.5);
  const pageHeight = points(11);
  const columns = 3;
  const rows = 10;
  const marginX = points(0.25);
  const marginY = points(0.3);
  const gutterX = points(0.08);
  const gutterY = points(0.06);
  const cellWidth = (pageWidth - marginX * 2 - gutterX * (columns - 1)) / columns;
  const cellHeight = (pageHeight - marginY * 2 - gutterY * (rows - 1)) / rows;
  const perPage = columns * rows;

  prepared.forEach((label, index) => {
    if (index % perPage === 0) {
      doc.addPage();
    }

    const pageIndex = index % perPage;
    const row = Math.floor(pageIndex / columns);
    const column = pageIndex % columns;

    renderBarcodeLabelCard(doc, label, {
      x: marginX + column * (cellWidth + gutterX),
      y: marginY + row * (cellHeight + gutterY),
      width: cellWidth,
      height: cellHeight
    }, { compact: true });
  });

  if (prepared.length === 0) {
    doc.addPage();
  }

  return doc;
};
