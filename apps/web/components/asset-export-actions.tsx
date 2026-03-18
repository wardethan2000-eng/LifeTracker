"use client";

import type { ShareLink } from "@lifekeeper/types";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createShareLink,
  downloadAssetCsv,
  downloadAssetPdf,
  downloadComplianceAuditPdf,
  downloadHouseholdCsv,
  getShareLinks,
  revokeShareLink
} from "../lib/api";
import { formatDate, formatDateTime } from "../lib/formatters";
import { InlineError } from "./inline-error";

type AssetExportActionsProps = {
  assetId: string;
  assetTag: string;
  assetName: string;
  householdId: string;
};

type HouseholdCsvExportButtonProps = {
  householdId: string;
  dataset: "cost-dashboard" | "activity-log";
  label?: string;
};

const toDateBoundaryIso = (value: string | null, boundary: "start" | "end"): string | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}`);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
};

const getShareLinkStatus = (shareLink: ShareLink): string => {
  if (shareLink.isRevoked) {
    return "Revoked";
  }

  if (shareLink.expiresAt) {
    const expiresAt = new Date(shareLink.expiresAt);

    if (expiresAt.getTime() < Date.now()) {
      return `Expired ${formatDate(shareLink.expiresAt)}`;
    }

    return `Expires ${formatDate(shareLink.expiresAt)}`;
  }

  return "No expiration";
};

const buildDownloadOptions = (since?: string, until?: string): { since?: string; until?: string } => ({
  ...(since ? { since } : {}),
  ...(until ? { until } : {})
});

export function AssetExportActions({ assetId, assetTag, assetName, householdId }: AssetExportActionsProps): JSX.Element {
  const searchParams = useSearchParams();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCompliancePdf, setIsExportingCompliancePdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isShareFormVisible, setIsShareFormVisible] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [label, setLabel] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState<string | null>(null);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const since = toDateBoundaryIso(searchParams.get("since"), "start");
  const until = toDateBoundaryIso(searchParams.get("until"), "end");

  const loadShareLinks = async (): Promise<void> => {
    try {
      const result = await getShareLinks(householdId, assetId);
      setShareLinks(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load share links.");
    }
  };

  useEffect(() => {
    void loadShareLinks();
  }, [assetId, householdId]);

  const handleExportPdf = async (): Promise<void> => {
    try {
      setErrorMessage(null);
      setIsExportingPdf(true);
      await downloadAssetPdf(assetId, buildDownloadOptions(since, until));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export the PDF report.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCsv = async (): Promise<void> => {
    try {
      setErrorMessage(null);
      setIsExportingCsv(true);
      await downloadAssetCsv(assetId, "timeline", buildDownloadOptions(since, until));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export the CSV report.");
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportCompliancePdf = async (): Promise<void> => {
    try {
      setErrorMessage(null);
      setIsExportingCompliancePdf(true);
      await downloadComplianceAuditPdf(assetId, buildDownloadOptions(since, until));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export the compliance audit PDF report.");
    } finally {
      setIsExportingCompliancePdf(false);
    }
  };

  const handleCreateLink = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    try {
      setErrorMessage(null);
      setIsCreatingLink(true);
      const link = await createShareLink(householdId, {
        assetId,
        ...(label.trim() ? { label: label.trim() } : {}),
        ...(expirationDate
          ? { expiresAt: new Date(`${expirationDate}T23:59:59.999`).toISOString() }
          : {}),
        ...(since ? { dateRangeStart: since } : {}),
        ...(until ? { dateRangeEnd: until } : {})
      });
      const url = `${window.location.origin}/share/${link.token}`;
      setNewLinkUrl(url);
      setLabel("");
      setExpirationDate("");
      await loadShareLinks();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create a share link.");
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleCopyLink = async (): Promise<void> => {
    if (!newLinkUrl) {
      return;
    }

    try {
      setIsCopyingLink(true);
      await navigator.clipboard.writeText(newLinkUrl);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to copy the share link.");
    } finally {
      setIsCopyingLink(false);
    }
  };

  const handleRevoke = async (shareLinkId: string): Promise<void> => {
    try {
      setErrorMessage(null);
      await revokeShareLink(householdId, shareLinkId);
      await loadShareLinks();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to revoke the share link.");
    }
  };

  return (
    <div className="inline-stack inline-stack--sm">
      <div className="export-actions">
        <button type="button" className="button button--primary button--sm" onClick={() => { void handleExportPdf(); }} disabled={isExportingPdf}>
          {isExportingPdf ? "Exporting PDF..." : "Export PDF"}
        </button>
        <button type="button" className="button button--ghost button--sm" onClick={() => { void handleExportCompliancePdf(); }} disabled={isExportingCompliancePdf}>
          {isExportingCompliancePdf ? "Exporting Compliance..." : "Compliance Report"}
        </button>
        <button type="button" className="button button--ghost button--sm" onClick={() => { void handleExportCsv(); }} disabled={isExportingCsv}>
          {isExportingCsv ? "Exporting CSV..." : "Export CSV"}
        </button>
        <button type="button" className="button button--ghost button--sm" onClick={() => setIsShareFormVisible((current) => !current)}>
          {isShareFormVisible ? "Hide Share Link" : "Share Link"}
        </button>
      </div>

      <InlineError message={errorMessage} />

      {isShareFormVisible ? (
        <div className="share-link-form">
          <form onSubmit={(event) => { void handleCreateLink(event); }} className="inline-stack inline-stack--sm">
            <label className="field field--full">
              <span>Link Label</span>
              <input className="form-input" type="text" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={200} placeholder={`Share ${assetName}`} />
            </label>
            <label className="field">
              <span>Expiration Date</span>
              <input className="form-input" type="date" value={expirationDate} onChange={(event) => setExpirationDate(event.target.value)} />
            </label>
            <div className="inline-cluster inline-cluster--sm inline-cluster--center inline-cluster--wrap">
              <button type="submit" className="button button--primary button--sm" disabled={isCreatingLink}>
                {isCreatingLink ? "Creating..." : "Create Link"}
              </button>
              {(since || until) ? <span className="inline-note">Uses the current history date filter.</span> : null}
            </div>
          </form>

          {newLinkUrl ? (
            <div className="share-link-url">
              <input className="form-input" type="text" value={newLinkUrl} readOnly />
              <button type="button" className="button button--ghost button--sm" onClick={() => { void handleCopyLink(); }}>
                {isCopyingLink ? "Copying..." : "Copy"}
              </button>
            </div>
          ) : null}

          <div className="share-link-list">
            {shareLinks.length === 0 ? (
              <p className="panel__empty">No share links have been created for {assetTag} yet.</p>
            ) : shareLinks.map((shareLink) => (
              <div key={shareLink.id} className="share-link-list__item">
                <div>
                  <div className="share-link-list__label">{shareLink.label?.trim() || "Untitled"}</div>
                  <div className="share-link-list__meta">
                    Created {formatDateTime(shareLink.createdAt)} • {shareLink.viewCount} views • {getShareLinkStatus(shareLink)}
                  </div>
                </div>
                <button
                  type="button"
                  className="button button--ghost button--sm"
                  disabled={shareLink.isRevoked}
                  onClick={() => { void handleRevoke(shareLink.id); }}
                >
                  {shareLink.isRevoked ? "Revoked" : "Revoke"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function HouseholdCsvExportButton({ householdId, dataset, label = "Export CSV" }: HouseholdCsvExportButtonProps): JSX.Element {
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExport = async (): Promise<void> => {
    try {
      setErrorMessage(null);
      setIsExporting(true);
      await downloadHouseholdCsv(householdId, dataset);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export this CSV file.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="inline-stack inline-stack--xs">
      <button type="button" className="button button--ghost button--sm" onClick={() => { void handleExport(); }} disabled={isExporting}>
        {isExporting ? "Exporting..." : label}
      </button>
      <InlineError message={errorMessage} size="sm" />
    </div>
  );
}