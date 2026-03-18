import PDFDocument from "pdfkit";
import type {
  AnnualCostPdfInput,
  AssetTimelineItem,
  ComplianceAuditPdfInput,
  InventoryValuationPdfInput
} from "@lifekeeper/types";

type AssetHistoryPdfInput = {
  asset: {
    name: string;
    category: string;
    make?: string | null;
    model?: string | null;
    year?: number | null;
    assetTag?: string | null;
  };
  timelineItems: AssetTimelineItem[];
  costSummary: {
    lifetimeCost: number;
    yearToDateCost: number;
    rolling12MonthAverage: number;
    logCount: number;
  };
  dateRangeStart?: Date | null;
  dateRangeEnd?: Date | null;
};

const formatDate = (value: string | Date): string => new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
}).format(value instanceof Date ? value : new Date(value));

const formatDateTime = (value: Date): string => new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit"
}).format(value);

const formatCurrency = (value: number): string => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
}).format(value);

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const formatNumber = (value: number): string => new Intl.NumberFormat("en-US", {
  maximumFractionDigits: value % 1 === 0 ? 0 : 2
}).format(value);

const formatTimelineSourceLabel = (sourceType: AssetTimelineItem["sourceType"]): string => {
  switch (sourceType) {
    case "maintenance_log":
      return "Maintenance Log";
    case "timeline_entry":
      return "Manual Entry";
    case "project_event":
      return "Project Event";
    case "inventory_transaction":
      return "Inventory Transaction";
    case "schedule_change":
      return "Schedule Change";
    case "comment":
      return "Comment";
    case "condition_assessment":
      return "Condition Assessment";
    case "usage_reading":
      return "Usage Reading";
    default:
      return "Activity";
  }
};

const truncate = (value: string, maxLength: number): string => value.length > maxLength
  ? `${value.slice(0, maxLength).trimEnd()}...`
  : value;

const writeRule = (doc: PDFKit.PDFDocument): void => {
  const y = doc.y;
  doc.save();
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor("#d7dde5").lineWidth(1).stroke();
  doc.restore();
  doc.moveDown(0.6);
};

const ensureSpace = (doc: PDFKit.PDFDocument, minimumRemaining: number): void => {
  const remaining = doc.page.height - doc.page.margins.bottom - doc.y;

  if (remaining < minimumRemaining) {
    doc.addPage();
  }
};

type TableOptions = {
  headers: string[];
  rows: string[][];
  columnWidths: number[];
  headerFont?: string;
  headerSize?: number;
  rowFont?: string;
  rowSize?: number;
  alternateRowColor?: string;
};

const getCellColor = (header: string, value: string): string => {
  const normalizedHeader = header.trim().toLowerCase();
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedHeader === "status") {
    if (normalizedValue === "on time" || normalizedValue === "ok") {
      return "#16a34a";
    }

    if (normalizedValue === "low") {
      return "#f59e0b";
    }

    if (normalizedValue === "late" || normalizedValue === "missed" || normalizedValue === "out") {
      return "#dc2626";
    }
  }

  return "#111827";
};

const getCellAlign = (header: string, value: string): "left" | "right" | "center" => {
  const normalizedHeader = header.trim().toLowerCase();

  if (
    normalizedHeader.includes("cost")
    || normalizedHeader.includes("value")
    || normalizedHeader.includes("total")
    || normalizedHeader.includes("rate")
    || normalizedHeader.includes("delta")
    || normalizedHeader.includes("quantity")
    || normalizedHeader.includes("point")
    || normalizedHeader.includes("%")
    || value.startsWith("$")
    || value.endsWith("%")
  ) {
    return "right";
  }

  return normalizedHeader === "status" ? "center" : "left";
};

const writeKeyValueRows = (doc: PDFKit.PDFDocument, rows: Array<[string, string]>): void => {
  for (const [label, value] of rows) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(label, { continued: true, width: 260 });
    doc.font("Helvetica").fontSize(11).fillColor("#374151").text(value);
    doc.moveDown(0.35);
    writeRule(doc);
  }
};

export const writeTable = (doc: PDFKit.PDFDocument, options: TableOptions): void => {
  const {
    headers,
    rows,
    columnWidths,
    headerFont = "Helvetica-Bold",
    headerSize = 10,
    rowFont = "Helvetica",
    rowSize = 9,
    alternateRowColor = "#f9fafb"
  } = options;
  const tableLeft = doc.page.margins.left;
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const baseTextColor = "#111827";
  const drawHeader = (): void => {
    ensureSpace(doc, 28);
    const headerTop = doc.y;
    const headerHeight = 20;

    doc.save();
    doc.rect(tableLeft, headerTop, tableWidth, headerHeight).fill("#eef2f7");
    doc.restore();

    let x = tableLeft;
    headers.forEach((header, index) => {
      doc.font(headerFont).fontSize(headerSize).fillColor(baseTextColor).text(header, x + 4, headerTop + 5, {
        width: columnWidths[index]! - 8,
        align: getCellAlign(header, header)
      });
      x += columnWidths[index]!;
    });

    doc.moveTo(tableLeft, headerTop + headerHeight).lineTo(tableLeft + tableWidth, headerTop + headerHeight).strokeColor("#d7dde5").lineWidth(1).stroke();
    doc.y = headerTop + headerHeight;
  };

  drawHeader();

  rows.forEach((row, rowIndex) => {
    const rowHeight = Math.max(18, row.reduce((maxHeight, cell, cellIndex) => {
      const cellText = cell ?? "";
      const height = doc.font(rowFont).fontSize(rowSize).heightOfString(cellText, {
        width: columnWidths[cellIndex]! - 8,
        align: getCellAlign(headers[cellIndex] ?? "", cellText)
      });

      return Math.max(maxHeight, height + 8);
    }, 0));

    if (doc.page.height - doc.page.margins.bottom - doc.y < rowHeight + 8) {
      doc.addPage();
      drawHeader();
    }

    const rowTop = doc.y;

    if (rowIndex % 2 === 1) {
      doc.save();
      doc.rect(tableLeft, rowTop, tableWidth, rowHeight).fill(alternateRowColor);
      doc.restore();
    }

    let x = tableLeft;
    row.forEach((cell, cellIndex) => {
      const cellText = cell ?? "";
      doc.font(rowFont).fontSize(rowSize).fillColor(getCellColor(headers[cellIndex] ?? "", cellText)).text(cellText, x + 4, rowTop + 4, {
        width: columnWidths[cellIndex]! - 8,
        align: getCellAlign(headers[cellIndex] ?? "", cellText)
      });
      x += columnWidths[cellIndex]!;
    });

    doc.moveTo(tableLeft, rowTop + rowHeight).lineTo(tableLeft + tableWidth, rowTop + rowHeight).strokeColor("#e5e7eb").lineWidth(1).stroke();
    doc.y = rowTop + rowHeight;
  });

  doc.moveDown(0.5);
};

const buildRangeLabel = (start?: Date | null, end?: Date | null): string => (
  start || end
    ? `${start ? formatDate(start) : "Beginning"} to ${end ? formatDate(end) : "Present"}`
    : "Complete History"
);

const formatDeltaLabel = (value: number | null): string => {
  if (value === null) {
    return "";
  }

  if (value === 0) {
    return "On due date";
  }

  if (value < 0) {
    return `${Math.abs(value)} day${Math.abs(value) === 1 ? "" : "s"} early`;
  }

  return `${value} day${value === 1 ? "" : "s"} late`;
};

const drawMonthlyBars = (
  doc: PDFKit.PDFDocument,
  rows: AnnualCostPdfInput["monthlyRows"]
): void => {
  const legendItems = [
    { label: "Maintenance", color: "#4f6ef7" },
    { label: "Projects", color: "#f59e0b" },
    { label: "Inventory", color: "#22c55e" }
  ];
  const maxTotal = Math.max(...rows.map((row) => row.totalCost), 0);
  const labelWidth = 36;
  const barWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right - labelWidth - 12;

  if (maxTotal <= 0) {
    doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text("No monthly costs were recorded for this year.");
    return;
  }

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text("Monthly Cost Bars");
  doc.moveDown(0.4);

  legendItems.forEach((item) => {
    const y = doc.y;
    doc.save();
    doc.rect(doc.page.margins.left, y + 2, 10, 10).fill(item.color);
    doc.restore();
    doc.font("Helvetica").fontSize(9).fillColor("#374151").text(item.label, doc.page.margins.left + 16, y, { continued: false });
  });

  doc.moveDown(0.4);

  rows.forEach((row) => {
    ensureSpace(doc, 16);
    const y = doc.y;
    const scale = barWidth / maxTotal;
    const maintenanceWidth = row.maintenanceCost * scale;
    const projectWidth = row.projectCost * scale;
    const inventoryWidth = row.inventoryCost * scale;
    let cursorX = doc.page.margins.left + labelWidth;

    doc.font("Helvetica").fontSize(9).fillColor("#111827").text(row.month, doc.page.margins.left, y, { width: labelWidth - 4 });

    if (maintenanceWidth > 0) {
      doc.save();
      doc.rect(cursorX, y + 2, maintenanceWidth, 9).fill("#4f6ef7");
      doc.restore();
      cursorX += maintenanceWidth;
    }

    if (projectWidth > 0) {
      doc.save();
      doc.rect(cursorX, y + 2, projectWidth, 9).fill("#f59e0b");
      doc.restore();
      cursorX += projectWidth;
    }

    if (inventoryWidth > 0) {
      doc.save();
      doc.rect(cursorX, y + 2, inventoryWidth, 9).fill("#22c55e");
      doc.restore();
    }

    doc.font("Helvetica").fontSize(8).fillColor("#4b5563").text(formatCurrency(row.totalCost), doc.page.margins.left + labelWidth + barWidth + 6, y, {
      width: 70,
      align: "right"
    });
    doc.y = y + 14;
  });
};

export const generateAssetHistoryPdf = (input: AssetHistoryPdfInput): PDFKit.PDFDocument => {
  const doc = new PDFDocument({ margin: 50, autoFirstPage: true });

  const rangeLabel = input.dateRangeStart || input.dateRangeEnd
    ? `${input.dateRangeStart ? formatDate(input.dateRangeStart) : "Beginning"} to ${input.dateRangeEnd ? formatDate(input.dateRangeEnd) : "Present"}`
    : "Complete History";
  const makeModelYear = [input.asset.year ?? null, input.asset.make ?? null, input.asset.model ?? null]
    .filter((part): part is string | number => part !== null && part !== undefined && String(part).trim().length > 0)
    .join(" ");

  doc.font("Helvetica-Bold").fontSize(24).text("Asset History Report", 50, 110, {
    align: "center"
  });
  doc.moveDown(0.6);
  doc.font("Helvetica").fontSize(18).text(input.asset.name, {
    align: "center"
  });
  doc.moveDown(2);

  doc.font("Helvetica-Bold").fontSize(12).text("Asset Details");
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(11);
  if (makeModelYear) {
    doc.text(`Make / Model / Year: ${makeModelYear}`);
  }
  doc.text(`Asset Tag: ${input.asset.assetTag ?? "Not set"}`);
  doc.text(`Category: ${input.asset.category}`);
  doc.text(`Date Range: ${rangeLabel}`);

  doc.font("Helvetica").fontSize(10).text(
    `Generated ${formatDateTime(new Date())}\nGenerated by LifeKeeper`,
    50,
    doc.page.height - doc.page.margins.bottom - 40,
    { align: "left" }
  );

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(18).text("Timeline");
  doc.moveDown(0.8);

  for (const item of input.timelineItems) {
    ensureSpace(doc, 120);

    doc.font("Helvetica").fontSize(10).fillColor("#1f2937").text(formatDate(item.eventDate));
    doc.moveDown(0.2);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#374151").text(formatTimelineSourceLabel(item.sourceType));
    doc.moveDown(0.2);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(item.title);

    if (item.description) {
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10).fillColor("#374151").text(truncate(item.description, 300));
    }

    if (typeof item.cost === "number") {
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10).fillColor("#111827").text(`Cost: ${formatCurrency(item.cost)}`);
    }

    if (item.parts && item.parts.length > 0) {
      doc.moveDown(0.3);
      for (const part of item.parts) {
        const partDetails = [
          part.name,
          part.partNumber ? `Part # ${part.partNumber}` : null,
          `Qty ${part.quantity}`,
          typeof part.unitCost === "number" ? formatCurrency(part.unitCost) : null
        ].filter((entry): entry is string => Boolean(entry)).join(" | ");

        doc.font("Helvetica").fontSize(8).fillColor("#4b5563").text(`  ${partDetails}`);
      }
    }

    doc.moveDown(0.5);
    writeRule(doc);
  }

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Cost Summary");
  doc.moveDown(1);

  const summaryRows: Array<[string, string]> = [
    ["Lifetime Cost", formatCurrency(input.costSummary.lifetimeCost)],
    ["Year-to-Date Cost", formatCurrency(input.costSummary.yearToDateCost)],
    ["Rolling 12-Month Average", formatCurrency(input.costSummary.rolling12MonthAverage)],
    ["Total Maintenance Logs", String(input.costSummary.logCount)]
  ];

  for (const [label, value] of summaryRows) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(label, { continued: true, width: 240 });
    doc.font("Helvetica").fontSize(11).fillColor("#374151").text(value);
    doc.moveDown(0.4);
    writeRule(doc);
  }

  return doc;
};

export const generateComplianceAuditPdf = (input: ComplianceAuditPdfInput): PDFKit.PDFDocument => {
  const doc = new PDFDocument({ margin: 50, autoFirstPage: true });
  const makeModelYear = [input.asset.year ?? null, input.asset.make ?? null, input.asset.model ?? null]
    .filter((part): part is string | number => part !== null && part !== undefined && String(part).trim().length > 0)
    .join(" ");

  doc.font("Helvetica-Bold").fontSize(24).fillColor("#111827").text("Compliance Audit Report", 50, 110, { align: "center" });
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(18).fillColor("#111827").text(input.asset.name, { align: "center" });
  doc.moveDown(1.4);
  doc.font("Helvetica").fontSize(12).fillColor("#374151").text(
    `Make / Model / Year: ${makeModelYear || "Not recorded"}`,
    { align: "center" }
  );
  doc.text(`Asset Tag: ${input.asset.assetTag ?? "Not set"}`, { align: "center" });
  doc.text(`Date Range: ${buildRangeLabel(input.dateRangeStart, input.dateRangeEnd)}`, { align: "center" });
  doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(input.householdName, 50, doc.page.height - doc.page.margins.bottom - 58, { align: "left" });
  doc.text(`Generated ${formatDateTime(input.generatedAt)}`, 50, doc.page.height - doc.page.margins.bottom - 40, { align: "left" });

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Compliance Summary");
  doc.moveDown(0.8);
  writeKeyValueRows(doc, [
    ["Total Scheduled Maintenance Items", String(input.summary.totalScheduledMaintenanceItems)],
    ["Completed On Time", String(input.summary.completedOnTime)],
    ["Completed Late", String(input.summary.completedLate)],
    ["Missed / Overdue", String(input.summary.missedOrOverdue)],
    ["Overall On-Time Rate", formatPercent(input.summary.overallOnTimeRate)],
    ["Regulatory Schedules Tracked", String(input.summary.regulatorySchedulesTracked)],
    ["Regulatory On-Time Rate", formatPercent(input.summary.regulatoryOnTimeRate)]
  ]);

  if (input.summary.regulatoryBreakdown.length > 0) {
    ensureSpace(doc, 120);
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text("Regulatory Compliance");
    doc.moveDown(0.4);
    writeTable(doc, {
      headers: ["Schedule", "On-Time Rate", "Completed Cycles"],
      rows: input.summary.regulatoryBreakdown.map((entry) => [
        entry.scheduleName,
        formatPercent(entry.onTimeRate),
        String(entry.totalCycles)
      ]),
      columnWidths: [300, 100, 100],
      rowSize: 9
    });
  }

  ensureSpace(doc, 120);
  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text("Supplementary Evidence");
  doc.moveDown(0.4);
  writeKeyValueRows(doc, [
    ["Condition Assessments", String(input.summary.supplementaryEvidence.conditionAssessmentCount)],
    ["Usage Readings", String(input.summary.supplementaryEvidence.usageReadingCount)]
  ]);

  if (input.summary.supplementaryEvidence.latestConditionAssessments.length > 0) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text("Latest Condition Assessments");
    doc.moveDown(0.2);
    input.summary.supplementaryEvidence.latestConditionAssessments.forEach((entry) => {
      doc.font("Helvetica").fontSize(9).fillColor("#374151").text(
        `${formatDate(entry.assessedAt)} • Score ${entry.score}${entry.notes ? ` • ${truncate(entry.notes, 90)}` : ""}`
      );
    });
    doc.moveDown(0.5);
  }

  if (input.summary.supplementaryEvidence.latestUsageReadings.length > 0) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text("Latest Usage Readings");
    doc.moveDown(0.2);
    input.summary.supplementaryEvidence.latestUsageReadings.forEach((entry) => {
      doc.font("Helvetica").fontSize(9).fillColor("#374151").text(
        `${formatDate(entry.recordedAt)} • ${entry.metricName}: ${formatNumber(entry.value)} ${entry.unit}${entry.notes ? ` • ${truncate(entry.notes, 90)}` : ""}`
      );
    });
  }

  input.schedules.forEach((schedule, index) => {
    if (index === 0) {
      doc.addPage();
    } else {
      ensureSpace(doc, 170);
    }

    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text(schedule.scheduleName);
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(10).fillColor("#374151").text(
      `Category: ${schedule.category} | Trigger: ${schedule.triggerType} | Interval: ${schedule.intervalLabel} | Regulatory: ${schedule.isRegulatory ? "Yes" : "No"}`
    );
    doc.moveDown(0.5);

    if (schedule.records.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text("No completions or overdue cycles were recorded for the selected period.");
      doc.moveDown(0.8);
    } else {
      writeTable(doc, {
        headers: ["Due Date", "Completed Date", "Delta", "Status", "Cost", "Notes"],
        rows: schedule.records.map((record) => [
          record.dueDate ? formatDate(record.dueDate) : "—",
          record.completedDate ? formatDate(record.completedDate) : "—",
          formatDeltaLabel(record.deltaDays),
          record.status,
          typeof record.cost === "number" ? formatCurrency(record.cost) : "—",
          record.notes ? truncate(record.notes, 80) : "—"
        ]),
        columnWidths: [72, 82, 88, 60, 68, 130],
        rowSize: 9
      });
    }

    if (schedule.evidenceSummary) {
      doc.font("Helvetica").fontSize(9).fillColor("#4b5563").text(schedule.evidenceSummary);
      doc.moveDown(0.6);
    }
  });

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text("Certification");
  doc.moveDown(1);
  doc.font("Helvetica").fontSize(11).fillColor("#374151").text("This report was automatically generated from maintenance records in LifeKeeper.");
  doc.moveDown(0.5);
  doc.text(`Report generated: ${formatDateTime(input.generatedAt)}`);
  doc.moveDown(0.5);
  doc.text("Data integrity: All records are timestamped at creation and cannot be retroactively modified.");

  return doc;
};

export const generateAnnualCostPdf = (input: AnnualCostPdfInput): PDFKit.PDFDocument => {
  const doc = new PDFDocument({ margin: 50, autoFirstPage: true });

  doc.font("Helvetica-Bold").fontSize(24).fillColor("#111827").text(`Annual Cost Summary - ${input.year}`, 50, 110, { align: "center" });
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(18).fillColor("#111827").text(input.householdName, { align: "center" });
  doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(`Generated ${formatDateTime(input.generatedAt)}`, 50, doc.page.height - doc.page.margins.bottom - 40, { align: "left" });

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Summary");
  doc.moveDown(0.8);
  writeKeyValueRows(doc, [
    ["Total Maintenance Cost", formatCurrency(input.summary.totalMaintenanceCost)],
    ["Total Project Expenses", formatCurrency(input.summary.totalProjectExpenses)],
    ["Total Inventory Purchases", formatCurrency(input.summary.totalInventoryPurchases)],
    ["Grand Total", formatCurrency(input.summary.grandTotal)],
    ["Number of Assets Maintained", String(input.summary.assetsMaintainedCount)],
    ["Total Maintenance Events", String(input.summary.maintenanceEventCount)],
    ["Average Cost Per Maintenance Event", formatCurrency(input.summary.averageCostPerMaintenanceEvent)]
  ]);

  if (input.summary.yearOverYear) {
    const direction = input.summary.yearOverYear.deltaAmount >= 0 ? "+" : "-";
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text("Year-over-Year Change");
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(11).fillColor("#374151").text(
      `vs ${input.summary.yearOverYear.priorYear}: ${direction}${Math.abs(input.summary.yearOverYear.deltaPercent).toFixed(1)}% (${formatCurrency(input.summary.yearOverYear.deltaAmount)})`
    );
  }

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Cost by Asset");
  doc.moveDown(0.6);
  writeTable(doc, {
    headers: ["Asset Name", "Category", "Maintenance", "Project", "Total", "% of Grand Total"],
    rows: [
      ...input.assetRows.map((row) => [
        row.assetName,
        row.category,
        formatCurrency(row.maintenanceCost),
        formatCurrency(row.projectCost),
        formatCurrency(row.totalCost),
        formatPercent(row.percentOfGrandTotal)
      ]),
      [
        "Totals",
        "",
        formatCurrency(input.assetRows.reduce((sum, row) => sum + row.maintenanceCost, 0)),
        formatCurrency(input.assetRows.reduce((sum, row) => sum + row.projectCost, 0)),
        formatCurrency(input.assetRows.reduce((sum, row) => sum + row.totalCost, 0)),
        formatPercent(input.assetRows.reduce((sum, row) => sum + row.percentOfGrandTotal, 0))
      ]
    ],
    columnWidths: [170, 90, 78, 72, 70, 90],
    headerSize: 10,
    rowSize: 9
  });

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Monthly Breakdown");
  doc.moveDown(0.6);
  writeTable(doc, {
    headers: ["Month", "Maintenance", "Projects", "Inventory", "Total"],
    rows: [
      ...input.monthlyRows.map((row) => [
        row.month,
        formatCurrency(row.maintenanceCost),
        formatCurrency(row.projectCost),
        formatCurrency(row.inventoryCost),
        formatCurrency(row.totalCost)
      ]),
      [
        "Totals",
        formatCurrency(input.monthlyRows.reduce((sum, row) => sum + row.maintenanceCost, 0)),
        formatCurrency(input.monthlyRows.reduce((sum, row) => sum + row.projectCost, 0)),
        formatCurrency(input.monthlyRows.reduce((sum, row) => sum + row.inventoryCost, 0)),
        formatCurrency(input.monthlyRows.reduce((sum, row) => sum + row.totalCost, 0))
      ]
    ],
    columnWidths: [80, 105, 105, 105, 105],
    rowSize: 9
  });
  drawMonthlyBars(doc, input.monthlyRows);

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Cost by Maintenance Category");
  doc.moveDown(0.6);
  writeTable(doc, {
    headers: ["Category", "Event Count", "Total Cost", "Avg Cost", "% of Maintenance Total"],
    rows: input.categoryRows.map((row) => [
      row.category,
      String(row.eventCount),
      formatCurrency(row.totalCost),
      formatCurrency(row.averageCost),
      formatPercent(row.percentOfMaintenanceTotal)
    ]),
    columnWidths: [150, 85, 100, 90, 125],
    rowSize: 9
  });

  if (input.providerRows.length > 0) {
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Service Provider Spend");
    doc.moveDown(0.6);
    writeTable(doc, {
      headers: ["Provider Name", "Event Count", "Total Spend", "Assets Serviced"],
      rows: input.providerRows.map((row) => [
        row.providerName,
        String(row.eventCount),
        formatCurrency(row.totalSpend),
        truncate(row.assetsServiced.join(", "), 70) || "—"
      ]),
      columnWidths: [180, 80, 95, 165],
      rowSize: 9
    });
  }

  return doc;
};

export const generateInventoryValuationPdf = (input: InventoryValuationPdfInput): PDFKit.PDFDocument => {
  const doc = new PDFDocument({ margin: 50, autoFirstPage: true });

  doc.font("Helvetica-Bold").fontSize(24).fillColor("#111827").text("Inventory Valuation Report", 50, 110, { align: "center" });
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(18).fillColor("#111827").text(input.householdName, { align: "center" });
  doc.moveDown(0.6);
  doc.font("Helvetica").fontSize(14).fillColor("#374151").text(`As of ${formatDate(input.asOf)}`, { align: "center" });
  doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(`Generated ${formatDateTime(input.generatedAt)}`, 50, doc.page.height - doc.page.margins.bottom - 40, { align: "left" });

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Valuation Summary");
  doc.moveDown(0.8);
  writeKeyValueRows(doc, [
    ["Total Unique Items", String(input.summary.totalUniqueItems)],
    ["Total Quantity on Hand", formatNumber(input.summary.totalQuantityOnHand)],
    ["Estimated Total Value", formatCurrency(input.summary.estimatedTotalValue)],
    ["Items Below Reorder Point", String(input.summary.itemsBelowReorderPoint)],
    ["Categories Tracked", String(input.summary.categoriesTracked)]
  ]);

  if (input.reorderAlerts.length > 0) {
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text("Reorder Alerts");
    doc.moveDown(0.4);
    writeTable(doc, {
      headers: ["Item", "Current Qty", "Reorder Point", "Deficit"],
      rows: input.reorderAlerts.map((alert) => [
        alert.itemName,
        formatNumber(alert.currentQuantity),
        formatNumber(alert.reorderPoint),
        formatNumber(alert.deficit)
      ]),
      columnWidths: [230, 90, 100, 90],
      rowSize: 9
    });
  }

  doc.addPage();
  input.categories.forEach((category, index) => {
    if (index > 0) {
      ensureSpace(doc, 170);
    }

    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text(category.category);
    doc.moveDown(0.3);
    writeTable(doc, {
      headers: ["Item Name", "Quantity", "Unit", "Unit Cost", "Total Value", "Reorder Point", "Status"],
      rows: [
        ...category.items.map((item) => [
          item.itemName,
          formatNumber(item.quantity),
          item.unit,
          formatCurrency(item.unitCost),
          formatCurrency(item.totalValue),
          item.reorderPoint === null ? "—" : formatNumber(item.reorderPoint),
          item.status
        ]),
        ["Category Total", "", "", "", formatCurrency(category.subtotalValue), "", ""]
      ],
      columnWidths: [154, 58, 55, 76, 84, 83, 50],
      rowSize: 9
    });
  });

  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text("Valuation Notes");
  doc.moveDown(1);
  doc.font("Helvetica").fontSize(11).fillColor("#374151").text("Valuations are based on the most recent purchase unit cost for each item.");
  doc.moveDown(0.5);
  doc.text("Items without purchase history are valued at $0.00.");
  doc.moveDown(0.5);
  doc.text("This report is a snapshot as of the generation date and does not reflect subsequent changes.");

  return doc;
};