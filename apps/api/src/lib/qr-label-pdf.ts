import PDFDocument from "pdfkit";
import QRCode from "qrcode";

type PrintableLabel = {
  code: string;
  title: string;
  subtitle?: string | null;
  footer?: string | null;
  qrPayloadUrl: string;
};

type PreparedLabel = PrintableLabel & {
  qrImage: Buffer;
};

const points = (value: number): number => value * 72;

const prepareLabels = async (labels: PrintableLabel[], qrSize: number): Promise<PreparedLabel[]> => Promise.all(
  labels.map(async (label) => ({
    ...label,
    qrImage: await QRCode.toBuffer(label.qrPayloadUrl, {
      type: "png",
      width: qrSize,
      margin: 1
    })
  }))
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

const renderLabelCard = (
  doc: PDFKit.PDFDocument,
  label: PreparedLabel,
  bounds: { x: number; y: number; width: number; height: number },
  options: { compact: boolean }
): void => {
  const padding = options.compact ? 6 : 18;
  const x = bounds.x + padding;
  const y = bounds.y + padding;
  const width = bounds.width - (padding * 2);
  const height = bounds.height - (padding * 2);
  const codeMaxSize = options.compact ? 15 : 24;
  const titleMaxSize = options.compact ? 9 : 14;
  const subtitleMaxSize = options.compact ? 7 : 11;
  const footerMaxSize = options.compact ? 6 : 9;
  const qrSize = Math.min(options.compact ? 42 : 140, width, height * (options.compact ? 0.46 : 0.52));
  const footerText = label.footer?.trim() ?? "";
  const subtitleText = label.subtitle?.trim() ?? "";

  doc.save();
  doc.roundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 8).lineWidth(0.75).stroke("#cbd5e1");

  const codeSize = fitText(doc, label.code, width, codeMaxSize, options.compact ? 11 : 16, "Helvetica-Bold");
  doc.font("Helvetica-Bold").fontSize(codeSize).fillColor("#0f172a");
  const codeHeight = doc.currentLineHeight();
  doc.text(label.code, x, y, { width, align: "center", lineBreak: false });

  const qrX = bounds.x + ((bounds.width - qrSize) / 2);
  const qrY = y + codeHeight + (options.compact ? 4 : 12);
  doc.image(label.qrImage, qrX, qrY, { fit: [qrSize, qrSize], align: "center", valign: "center" });

  let textY = qrY + qrSize + (options.compact ? 3 : 12);

  const titleSize = fitText(doc, label.title, width, titleMaxSize, options.compact ? 7 : 10, "Helvetica");
  doc.font("Helvetica").fontSize(titleSize).fillColor("#0f172a");
  const titleHeight = doc.heightOfString(label.title, { width, align: "center" });
  doc.text(label.title, x, textY, { width, align: "center", lineGap: 0 });
  textY += titleHeight;

  if (subtitleText) {
    const subtitleSize = fitText(doc, subtitleText, width, subtitleMaxSize, options.compact ? 6 : 8, "Helvetica-Bold");
    doc.font("Helvetica-Bold").fontSize(subtitleSize).fillColor("#334155");
    const subtitleHeight = doc.heightOfString(subtitleText, { width, align: "center" });
    doc.text(subtitleText, x, textY + 2, { width, align: "center", lineGap: 0 });
    textY += subtitleHeight + 2;
  }

  if (footerText) {
    const footerHeightLimit = Math.max(18, height - (textY - y) - 2);
    const footerSize = fitText(doc, footerText, width, footerMaxSize, options.compact ? 5 : 7, "Helvetica");
    doc.font("Helvetica").fontSize(footerSize).fillColor("#64748b");
    doc.text(footerText, x, bounds.y + bounds.height - padding - footerHeightLimit, {
      width,
      height: footerHeightLimit,
      align: "center",
      ellipsis: true
    });
  }

  doc.restore();
};

export const createSingleLabelPdf = async (label: PrintableLabel): Promise<PDFKit.PDFDocument> => {
  const [prepared] = await prepareLabels([label], 400);

  if (!prepared) {
    throw new Error("Label preparation failed.");
  }

  const doc = new PDFDocument({ size: [points(4), points(6)], margin: 0, autoFirstPage: true });

  renderLabelCard(doc, prepared, {
    x: points(0.3),
    y: points(0.45),
    width: points(3.4),
    height: points(5.1)
  }, { compact: false });

  return doc;
};

export const createBatchLabelPdf = async (labels: PrintableLabel[]): Promise<PDFKit.PDFDocument> => {
  const prepared = await prepareLabels(labels, 180);
  const doc = new PDFDocument({ size: "LETTER", margin: 0, autoFirstPage: false });
  const pageWidth = points(8.5);
  const pageHeight = points(11);
  const columns = 3;
  const rows = 8;
  const marginX = points(0.25);
  const marginY = points(0.35);
  const gutterX = points(0.08);
  const gutterY = points(0.08);
  const cellWidth = (pageWidth - (marginX * 2) - (gutterX * (columns - 1))) / columns;
  const cellHeight = (pageHeight - (marginY * 2) - (gutterY * (rows - 1))) / rows;
  const perPage = columns * rows;

  prepared.forEach((label, index) => {
    if (index % perPage === 0) {
      doc.addPage();
    }

    const pageIndex = index % perPage;
    const row = Math.floor(pageIndex / columns);
    const column = pageIndex % columns;

    renderLabelCard(doc, label, {
      x: marginX + (column * (cellWidth + gutterX)),
      y: marginY + (row * (cellHeight + gutterY)),
      width: cellWidth,
      height: cellHeight
    }, { compact: true });
  });

  if (prepared.length === 0) {
    doc.addPage();
  }

  return doc;
};