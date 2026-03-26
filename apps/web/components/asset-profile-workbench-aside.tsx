"use client";

import type { Asset, SpaceResponse } from "@lifekeeper/types";
import type { JSX } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { AssetProfileFormValues } from "../lib/validation/forms";
import { useState } from "react";
import {
  conditionSummary,
  dispositionSummary,
  insuranceSummary,
  locationSummary,
  purchaseSummary,
  warrantySummary
} from "./card-summary-line";
import { Card } from "./card";
import { CollapsibleCard } from "./collapsible-card";
import { InlineError } from "./inline-error";
import { SpacePickerField } from "./space-picker-field";
import { useTimezone } from "../lib/timezone-context";

type AssetWorkbenchAsideProps = {
  initialAsset: Asset | undefined;
  saveAsPreset: boolean;
  assetTypeLabel: string;
  assetTypeDescription: string;
  assetTypeKey: string;
  register: UseFormRegister<AssetProfileFormValues>;
  errors: FieldErrors<AssetProfileFormValues>;
  onSaveAsPresetChange: (value: boolean) => void;
  spaces?: SpaceResponse[];
};

export function AssetProfileWorkbenchAside({
  initialAsset,
  saveAsPreset,
  assetTypeLabel,
  assetTypeDescription,
  assetTypeKey,
  register,
  errors,
  onSaveAsPresetChange,
  spaces = [],
}: AssetWorkbenchAsideProps): JSX.Element {
  const { timezone } = useTimezone();
  const [spaceId, setSpaceId] = useState<string>(initialAsset?.spaceId ?? "");
  return (
    <div className="resource-layout__aside">
      <Card title="Visibility">
        <label className="field">
          <span>Who can see this asset</span>
          <select {...register("visibility")}>
            <option value="shared">Shared (visible to household)</option>
            <option value="personal">Personal (only you)</option>
          </select>
          <InlineError message={errors.visibility?.message} size="sm" />
        </label>
      </Card>

      <Card title="Template">
        <label className="checkbox-field">
          <input type="checkbox" checked={saveAsPreset} onChange={(event) => onSaveAsPresetChange(event.target.checked)} />
          <span>Save this setup as a reusable template</span>
        </label>
        {saveAsPreset ? (
          <div className="workbench-grid" style={{ marginTop: "12px" }}>
            <label className="field">
              <span>Template Name</span>
              <input type="text" placeholder='e.g. "My Vehicle Profile"' {...register("presetLabel")} />
              <InlineError message={errors.presetLabel?.message} size="sm" />
            </label>
            <label className="field field--full">
              <span>Description</span>
              <textarea rows={2} placeholder="What this template is for" {...register("presetDescription")} />
              <InlineError message={errors.presetDescription?.message} size="sm" />
            </label>
            <label className="field field--full">
              <span>Tags (comma separated)</span>
              <input type="text" placeholder="vehicle, outdoor, power-tool" {...register("presetTags")} />
              <InlineError message={errors.presetTags?.message} size="sm" />
            </label>
            <input type="hidden" name="presetKeyOverride" value={assetTypeKey} />
          </div>
        ) : null}
      </Card>

      {initialAsset ? (
        <>
          <CollapsibleCard title="Purchase Details" summary={purchaseSummary(initialAsset, timezone)}>
            <div className="workbench-grid">
              <label className="field"><span>Purchase Date</span><input type="date" {...register("purchaseDate")} /><InlineError message={errors.purchaseDate?.message} size="sm" /></label>
              <label className="field"><span>Purchase Price</span><input type="number" name="purchaseDetails.price" min="0" step="0.01" defaultValue={initialAsset.purchaseDetails?.price ?? ""} /></label>
              <label className="field"><span>Vendor</span><input type="text" name="purchaseDetails.vendor" defaultValue={initialAsset.purchaseDetails?.vendor ?? ""} /></label>
              <label className="field"><span>Condition at Purchase</span><select name="purchaseDetails.condition" defaultValue={initialAsset.purchaseDetails?.condition ?? ""}><option value="">Unknown</option><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></label>
              <label className="field"><span>Financing</span><input type="text" name="purchaseDetails.financing" defaultValue={initialAsset.purchaseDetails?.financing ?? ""} /></label>
              <label className="field field--full"><span>Receipt Reference</span><input type="text" name="purchaseDetails.receiptRef" defaultValue={initialAsset.purchaseDetails?.receiptRef ?? ""} /></label>
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Warranty Info" summary={warrantySummary(initialAsset, timezone)}>
            <div className="workbench-grid">
              <label className="field"><span>Provider</span><input type="text" name="warrantyDetails.provider" defaultValue={initialAsset.warrantyDetails?.provider ?? ""} /></label>
              <label className="field"><span>Policy / Contract</span><input type="text" name="warrantyDetails.policyNumber" defaultValue={initialAsset.warrantyDetails?.policyNumber ?? ""} /></label>
              <label className="field"><span>Start Date</span><input type="date" name="warrantyDetails.startDate" defaultValue={initialAsset.warrantyDetails?.startDate ? initialAsset.warrantyDetails.startDate.slice(0, 10) : ""} /></label>
              <label className="field"><span>End Date</span><input type="date" name="warrantyDetails.endDate" defaultValue={initialAsset.warrantyDetails?.endDate ? initialAsset.warrantyDetails.endDate.slice(0, 10) : ""} /></label>
              <label className="field"><span>Coverage Type</span><input type="text" name="warrantyDetails.coverageType" defaultValue={initialAsset.warrantyDetails?.coverageType ?? ""} /></label>
              <label className="field field--full"><span>Notes</span><textarea name="warrantyDetails.notes" rows={2} defaultValue={initialAsset.warrantyDetails?.notes ?? ""} /></label>
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Location Details" summary={locationSummary(initialAsset)}>
            <div className="workbench-grid">
              <input type="hidden" name="spaceId" value={spaceId} />
              {spaces.length > 0 && (
                <SpacePickerField
                  label="Assigned Space"
                  spaces={spaces}
                  value={spaceId}
                  onChange={setSpaceId}
                  placeholder="No space assigned"
                  fullWidth
                />
              )}
              <label className="field"><span>Property</span><input type="text" name="locationDetails.propertyName" defaultValue={initialAsset.locationDetails?.propertyName ?? ""} /></label>
              <label className="field"><span>Building</span><input type="text" name="locationDetails.building" defaultValue={initialAsset.locationDetails?.building ?? ""} /></label>
              <label className="field"><span>Room / Area</span><input type="text" name="locationDetails.room" defaultValue={initialAsset.locationDetails?.room ?? ""} /></label>
              <label className="field"><span>Latitude</span><input type="number" name="locationDetails.latitude" min="-90" max="90" step="0.000001" defaultValue={initialAsset.locationDetails?.latitude ?? ""} /></label>
              <label className="field"><span>Longitude</span><input type="number" name="locationDetails.longitude" min="-180" max="180" step="0.000001" defaultValue={initialAsset.locationDetails?.longitude ?? ""} /></label>
              <label className="field field--full"><span>Notes</span><textarea name="locationDetails.notes" rows={2} defaultValue={initialAsset.locationDetails?.notes ?? ""} /></label>
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Insurance Details" summary={insuranceSummary(initialAsset)}>
            <div className="workbench-grid">
              <label className="field"><span>Provider</span><input type="text" name="insuranceDetails.provider" defaultValue={initialAsset.insuranceDetails?.provider ?? ""} /></label>
              <label className="field"><span>Policy Number</span><input type="text" name="insuranceDetails.policyNumber" defaultValue={initialAsset.insuranceDetails?.policyNumber ?? ""} /></label>
              <label className="field"><span>Coverage Amount</span><input type="number" name="insuranceDetails.coverageAmount" min="0" step="0.01" defaultValue={initialAsset.insuranceDetails?.coverageAmount ?? ""} /></label>
              <label className="field"><span>Deductible</span><input type="number" name="insuranceDetails.deductible" min="0" step="0.01" defaultValue={initialAsset.insuranceDetails?.deductible ?? ""} /></label>
              <label className="field"><span>Renewal Date</span><input type="date" name="insuranceDetails.renewalDate" defaultValue={initialAsset.insuranceDetails?.renewalDate ? initialAsset.insuranceDetails.renewalDate.slice(0, 10) : ""} /></label>
              <label className="field field--full"><span>Notes</span><textarea name="insuranceDetails.notes" rows={2} defaultValue={initialAsset.insuranceDetails?.notes ?? ""} /></label>
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Condition" summary={conditionSummary(initialAsset, timezone)}>
            <div className="workbench-grid">
              <label className="field">
                <span>Condition Score (1–10)</span>
                <input type="number" step="1" placeholder="1-10" {...register("conditionScore")} />
                <InlineError message={errors.conditionScore?.message} size="sm" />
              </label>
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Disposition" summary={dispositionSummary(initialAsset, timezone)}>
            <div className="workbench-grid">
              <label className="field"><span>Method</span><select name="dispositionDetails.method" defaultValue={initialAsset.dispositionDetails?.method ?? ""}><option value="">None</option><option value="sold">Sold</option><option value="donated">Donated</option><option value="scrapped">Scrapped</option><option value="recycled">Recycled</option><option value="lost">Lost</option></select></label>
              <label className="field"><span>Date</span><input type="date" name="dispositionDetails.date" defaultValue={initialAsset.dispositionDetails?.date ? initialAsset.dispositionDetails.date.slice(0, 10) : ""} /></label>
              <label className="field"><span>Sale Price</span><input type="number" name="dispositionDetails.salePrice" min="0" step="0.01" defaultValue={initialAsset.dispositionDetails?.salePrice ?? ""} /></label>
              <label className="field"><span>Buyer Info</span><input type="text" name="dispositionDetails.buyerInfo" defaultValue={initialAsset.dispositionDetails?.buyerInfo ?? ""} /></label>
              <label className="field field--full"><span>Notes</span><textarea name="dispositionDetails.notes" rows={2} defaultValue={initialAsset.dispositionDetails?.notes ?? ""} /></label>
            </div>
          </CollapsibleCard>
        </>
      ) : null}
    </div>
  );
}