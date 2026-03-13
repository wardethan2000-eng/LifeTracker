"use client";

import type { JSX } from "react";
import { useState } from "react";

type AssetLabelActionsProps = {
  assetId: string;
  assetName: string;
  assetTag: string;
};

const sanitizeFileSegment = (value: string): string => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 60) || "asset";

export function AssetLabelActions({ assetId, assetName, assetTag }: AssetLabelActionsProps): JSX.Element {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (): Promise<void> => {
    try {
      setIsDownloading(true);

      const response = await fetch(`/api/assets/${assetId}/label?format=png&size=600`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}.`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${sanitizeFileSegment(assetName)}-${assetTag.toLowerCase()}.png`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to download label PNG.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="asset-label-actions">
      <a
        href={`/assets/${assetId}/label`}
        target="_blank"
        rel="noreferrer"
        className="button button--primary button--sm"
      >
        Print Label
      </a>
      <button
        type="button"
        className="button button--ghost button--sm"
        onClick={() => {
          void handleDownload();
        }}
        disabled={isDownloading}
      >
        {isDownloading ? "Downloading..." : "Download PNG"}
      </button>
    </div>
  );
}