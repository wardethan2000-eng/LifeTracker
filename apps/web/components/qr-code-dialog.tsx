"use client";

import type { JSX } from "react";
import { useState } from "react";
import { CopyTextButton } from "./copy-text-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "./ui/dialog";

type QrCodeDialogProps = {
  triggerLabel?: string;
  dialogTitle: string;
  dialogDescription?: string;
  imageAlt: string;
  svgPath: string;
  pngPath: string;
  labelPath: string;
  fileBaseName: string;
  codeLabel: string;
  codeValue: string;
  details?: string[];
  copyValue: string;
};

const sanitizeFileSegment = (value: string): string => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 60) || "qr-code";

async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await fetch(path, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}.`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function QrCodeDialog({
  triggerLabel = "QR Code",
  dialogTitle,
  dialogDescription,
  imageAlt,
  svgPath,
  pngPath,
  labelPath,
  fileBaseName,
  codeLabel,
  codeValue,
  details = [],
  copyValue
}: QrCodeDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<null | "png" | "svg">(null);
  const safeFileBase = sanitizeFileSegment(fileBaseName);

  const handleDownload = async (format: "png" | "svg"): Promise<void> => {
    try {
      setDownloading(format);
      await downloadFile(format === "png" ? pngPath : svgPath, `${safeFileBase}.${format}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : `Unable to download ${format.toUpperCase()}.`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="button button--ghost button--sm">{triggerLabel}</button>
      </DialogTrigger>
      <DialogContent className="qr-dialog">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {dialogDescription ? <DialogDescription>{dialogDescription}</DialogDescription> : null}
        </DialogHeader>

        <div className="qr-dialog__body">
          <div className="qr-dialog__preview">
            <img src={svgPath} alt={imageAlt} className="qr-dialog__image" />
            <div className="qr-dialog__meta">
              <p className="qr-dialog__eyebrow">{codeLabel}</p>
              <p className="qr-dialog__code">{codeValue}</p>
              {details.map((detail) => <p key={detail} className="qr-dialog__detail">{detail}</p>)}
            </div>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            className="button button--ghost button--sm"
            onClick={() => {
              void handleDownload("png");
            }}
            disabled={downloading !== null}
          >
            {downloading === "png" ? "Downloading..." : "Download PNG"}
          </button>
          <button
            type="button"
            className="button button--ghost button--sm"
            onClick={() => {
              void handleDownload("svg");
            }}
            disabled={downloading !== null}
          >
            {downloading === "svg" ? "Downloading..." : "Download SVG"}
          </button>
          <button
            type="button"
            className="button button--primary button--sm"
            onClick={() => window.open(labelPath, "_blank", "noopener")}
          >
            Print Label
          </button>
          <CopyTextButton value={copyValue} label="Copy ID" copiedLabel="Copied ID" />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}