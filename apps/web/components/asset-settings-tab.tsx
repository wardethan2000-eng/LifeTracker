import type {
  Asset,
  AssetDetailResponse,
  AssetTransferList,
  CustomPresetProfile,
  HouseholdMember,
  LibraryPreset,
  SpaceResponse
} from "@aegis/types";
import type { JSX } from "react";
import {
  transferAssetAction,
  updateAssetAction
} from "../app/actions";
import { AssetDangerActions } from "./asset-danger-actions";
import { DemoteToIdeaButton } from "./demote-to-idea-button";
import { AssetLabelActions } from "./asset-label-actions";
import { AssetProfileWorkbench } from "./asset-profile-workbench";
import { ExpandableCard } from "./expandable-card";
import {
  formatCategoryLabel,
  formatDateTime
} from "../lib/formatters";
import { getDisplayPreferences } from "../lib/api";
import { formatTransferTypeLabel } from "../app/(dashboard)/assets/[assetId]/shared";

type AssetSettingsTabProps = {
  detail: AssetDetailResponse;
  assetId: string;
  libraryPresets: LibraryPreset[];
  customPresets: CustomPresetProfile[];
  householdAssets: Asset[];
  householdMembers: HouseholdMember[];
  transferHistory: AssetTransferList;
  spaces?: SpaceResponse[];
};

export async function AssetSettingsTab({
  detail,
  assetId,
  libraryPresets,
  customPresets,
  householdAssets,
  householdMembers,
  transferHistory,
  spaces = [],
}: AssetSettingsTabProps): Promise<JSX.Element> {
  const prefs = await getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" }));
  const matchingPresets = libraryPresets.filter((preset) => preset.category === detail.asset.category);
  const visiblePresets = matchingPresets.length > 0 ? matchingPresets : libraryPresets;
  const latestTransfer = transferHistory.items[0] ?? null;

  const editPreview = (
    <dl className="data-list" style={{ margin: 0 }}>
      <div><dt>Name</dt><dd>{detail.asset.name}</dd></div>
      <div><dt>Category</dt><dd>{formatCategoryLabel(detail.asset.category)}</dd></div>
      {detail.asset.manufacturer ? <div><dt>Make</dt><dd>{detail.asset.manufacturer}</dd></div> : null}
      {detail.asset.model ? <div><dt>Model</dt><dd>{detail.asset.model}</dd></div> : null}
      {detail.asset.description ? <div><dt>Description</dt><dd style={{ color: "var(--ink-muted)" }}>{detail.asset.description}</dd></div> : null}
    </dl>
  );

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section className="panel asset-label-panel">
        <div className="panel__header">
          <h2>Labels &amp; Ownership</h2>
          <span className="pill">{formatCategoryLabel(detail.asset.category)}</span>
        </div>
        <div className="panel__body--padded" style={{ display: "grid", gap: "16px" }}>
          <AssetLabelActions
            assetId={detail.asset.id}
            assetName={detail.asset.name}
            assetTag={detail.asset.assetTag}
          />
          {latestTransfer ? (
            <div className="schedule-card">
              <div className="schedule-card__summary">
                <div>
                  <h3>Latest Transfer</h3>
                  <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                    {latestTransfer.fromUser.displayName ?? "Unknown user"} to {latestTransfer.toUser.displayName ?? "Unknown user"}
                  </p>
                </div>
                <span className="pill">{formatTransferTypeLabel(latestTransfer.transferType)}</span>
              </div>
              <p style={{ margin: "8px 0 0 0", color: "var(--ink-muted)" }}>
                {formatDateTime(latestTransfer.transferredAt, undefined, undefined, prefs.dateFormat)}
              </p>
            </div>
          ) : (
            <p className="panel__empty">No transfer activity yet.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Transfer Asset</h2>
        </div>
        <div className="panel__body--padded">
          <form action={transferAssetAction} className="form-grid">
            <input type="hidden" name="assetId" value={detail.asset.id} />
            <input type="hidden" name="householdId" value={detail.asset.householdId} />
            <label className="field">
              <span>Transfer Type</span>
              <select name="transferType" defaultValue="reassignment">
                <option value="reassignment">Reassignment within household</option>
                <option value="household_transfer">Transfer to another household</option>
              </select>
            </label>
            <label className="field">
              <span>Reassign To</span>
              <select name="reassignmentToUserId" defaultValue={detail.asset.ownerId ?? ""}>
                <option value="">Select a household member</option>
                {householdMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.displayName ?? member.user.email ?? member.userId}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Target Household Id</span>
              <input type="text" name="toHouseholdId" placeholder="Required for household transfers" />
            </label>
            <label className="field">
              <span>Target User Id</span>
              <input type="text" name="householdTransferToUserId" placeholder="Destination household member user id" />
            </label>
            <label className="field">
              <span>Reason</span>
              <input type="text" name="reason" placeholder="sold, gifted, reassigned responsibility" />
            </label>
            <label className="field field--full">
              <span>Notes</span>
              <textarea name="notes" rows={3} placeholder="Optional handoff notes, sale details, or household context" />
            </label>
            <button type="submit" className="button button--primary">Transfer Asset</button>
          </form>
        </div>
      </section>

      <ExpandableCard
        title="Edit Asset Details"
        modalTitle="Edit Asset Details"
        previewContent={editPreview}
        defaultOpen={false}
      >
        <AssetProfileWorkbench
          action={updateAssetAction}
          householdId={detail.asset.householdId}
          householdAssets={householdAssets}
          submitLabel="Update Asset"
          libraryPresets={visiblePresets}
          customPresets={customPresets}
          initialAsset={detail.asset}
          spaces={spaces}
        />
      </ExpandableCard>

      <section className="panel panel--danger">
        <div className="panel__header">
          <h2>Danger Zone</h2>
        </div>
        <div className="panel__body--padded">
          <DemoteToIdeaButton
            householdId={detail.asset.householdId}
            sourceType="asset"
            sourceId={detail.asset.id}
            sourceName={detail.asset.name}
          />
          <AssetDangerActions
            householdId={detail.asset.householdId}
            assetId={detail.asset.id}
            isArchived={detail.asset.isArchived}
          />
        </div>
      </section>
    </div>
  );
}