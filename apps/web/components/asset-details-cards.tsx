"use client";

import type {
  AssetFieldDefinition,
  AssetFieldValue,
  DateFormat,
  DispositionDetails,
  InsuranceDetails,
  LocationDetails,
  PurchaseDetails,
  WarrantyDetails,
} from "@aegis/types";
import type { JSX } from "react";
import { useState, useTransition } from "react";
import { updateAssetFieldAction } from "../app/actions";
import { formatCurrency, formatDate } from "../lib/formatters";

// ─── helpers ────────────────────────────────────────────────────────────────

/** Convert ISO datetime string to YYYY-MM-DD for <input type="date"> */
function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** Convert YYYY-MM-DD to UTC midnight ISO string (or undefined if empty) */
function fromDateInputValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return new Date(`${trimmed}T00:00:00.000Z`).toISOString();
}

function ReadRow({ label, value }: { label: string; value: string | null | undefined }): JSX.Element | null {
  return (
    <div>
      <dt>{label}</dt>
      <dd style={{ color: value ? undefined : "var(--ink-muted)" }}>{value || "—"}</dd>
    </div>
  );
}

// ─── Purchase Details ────────────────────────────────────────────────────────

type AssetPurchaseDetailsCardProps = {
  assetId: string;
  householdId: string;
  purchaseDetails: PurchaseDetails | null;
  currencyCode: string;
};

export function AssetPurchaseDetailsCard({
  assetId,
  householdId,
  purchaseDetails,
  currencyCode,
}: AssetPurchaseDetailsCardProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [price, setPrice] = useState(purchaseDetails?.price?.toString() ?? "");
  const [vendor, setVendor] = useState(purchaseDetails?.vendor ?? "");
  const [condition, setCondition] = useState(purchaseDetails?.condition ?? "");
  const [financing, setFinancing] = useState(purchaseDetails?.financing ?? "");
  const [receiptRef, setReceiptRef] = useState(purchaseDetails?.receiptRef ?? "");

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const input: Record<string, unknown> = {};
      if (price.trim()) input.price = Number(price);
      if (vendor.trim()) input.vendor = vendor.trim();
      if (condition) input.condition = condition;
      if (financing.trim()) input.financing = financing.trim();
      if (receiptRef.trim()) input.receiptRef = receiptRef.trim();

      const result = await updateAssetFieldAction(assetId, householdId, {
        purchaseDetails: Object.keys(input).length > 0 ? input as PurchaseDetails : undefined,
      });
      if (result.success) {
        setEditing(false);
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Purchase Details</h2>
        {!editing && (
          <button type="button" className="button button--ghost button--xs" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      <div className="panel__body--padded">
        {editing ? (
          <div>
            <div className="workbench-grid">
              <label className="field">
                <span>Price</span>
                <input type="number" className="input" min="0" step="0.01" value={price}
                  onChange={(e) => setPrice(e.target.value)} disabled={isPending} />
              </label>
              <label className="field">
                <span>Vendor</span>
                <input type="text" className="input" value={vendor}
                  onChange={(e) => setVendor(e.target.value)} disabled={isPending} />
              </label>
              <label className="field">
                <span>Condition</span>
                <select className="input" value={condition}
                  onChange={(e) => setCondition(e.target.value)} disabled={isPending}>
                  <option value="">— not set —</option>
                  <option value="new">New</option>
                  <option value="used">Used</option>
                  <option value="refurbished">Refurbished</option>
                </select>
              </label>
              <label className="field">
                <span>Financing</span>
                <input type="text" className="input" value={financing}
                  onChange={(e) => setFinancing(e.target.value)} disabled={isPending} />
              </label>
              <label className="field field--full">
                <span>Receipt Reference</span>
                <input type="text" className="input" value={receiptRef}
                  onChange={(e) => setReceiptRef(e.target.value)} disabled={isPending} />
              </label>
            </div>
            {error && <p style={{ color: "var(--tone-danger, red)", marginTop: 8, fontSize: "0.85rem" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="button button--primary button--sm" onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </button>
              <button type="button" className="button button--ghost button--sm" onClick={() => setEditing(false)} disabled={isPending}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <dl className="data-list">
            <ReadRow label="Price" value={purchaseDetails?.price !== undefined ? formatCurrency(purchaseDetails.price, "—", currencyCode) : null} />
            <ReadRow label="Vendor" value={purchaseDetails?.vendor} />
            <ReadRow label="Condition" value={purchaseDetails?.condition} />
            <ReadRow label="Financing" value={purchaseDetails?.financing} />
            <ReadRow label="Receipt Reference" value={purchaseDetails?.receiptRef} />
          </dl>
        )}
      </div>
    </section>
  );
}

// ─── Warranty Details ────────────────────────────────────────────────────────

type AssetWarrantyDetailsCardProps = {
  assetId: string;
  householdId: string;
  warrantyDetails: WarrantyDetails | null;
  dateFormat: DateFormat;
};

export function AssetWarrantyDetailsCard({
  assetId,
  householdId,
  warrantyDetails,
  dateFormat,
}: AssetWarrantyDetailsCardProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [provider, setProvider] = useState(warrantyDetails?.provider ?? "");
  const [policyNumber, setPolicyNumber] = useState(warrantyDetails?.policyNumber ?? "");
  const [coverageType, setCoverageType] = useState(warrantyDetails?.coverageType ?? "");
  const [startDate, setStartDate] = useState(toDateInputValue(warrantyDetails?.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(warrantyDetails?.endDate));
  const [notes, setNotes] = useState(warrantyDetails?.notes ?? "");

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const input: Partial<WarrantyDetails> = {};
      if (provider.trim()) input.provider = provider.trim();
      if (policyNumber.trim()) input.policyNumber = policyNumber.trim();
      if (coverageType.trim()) input.coverageType = coverageType.trim();
      const startIso = fromDateInputValue(startDate);
      if (startIso) input.startDate = startIso;
      const endIso = fromDateInputValue(endDate);
      if (endIso) input.endDate = endIso;
      if (notes.trim()) input.notes = notes.trim();

      const result = await updateAssetFieldAction(assetId, householdId, {
        warrantyDetails: Object.keys(input).length > 0 ? input : undefined,
      });
      if (result.success) {
        setEditing(false);
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Warranty Details</h2>
        {!editing && (
          <button type="button" className="button button--ghost button--xs" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      <div className="panel__body--padded">
        {editing ? (
          <div>
            <div className="workbench-grid">
              <label className="field">
                <span>Provider</span>
                <input type="text" className="input" value={provider}
                  onChange={(e) => setProvider(e.target.value)} disabled={isPending} />
              </label>
              <label className="field">
                <span>Policy Number</span>
                <input type="text" className="input" value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)} disabled={isPending} />
              </label>
              <label className="field field--full">
                <span>Coverage Type</span>
                <input type="text" className="input" value={coverageType}
                  onChange={(e) => setCoverageType(e.target.value)} disabled={isPending} />
              </label>
              <label className="field">
                <span>Start Date</span>
                <input type="date" className="input" value={startDate}
                  onChange={(e) => setStartDate(e.target.value)} disabled={isPending} />
              </label>
              <label className="field">
                <span>End Date</span>
                <input type="date" className="input" value={endDate}
                  onChange={(e) => setEndDate(e.target.value)} disabled={isPending} />
              </label>
              <label className="field field--full">
                <span>Notes</span>
                <textarea className="input" rows={3} value={notes}
                  onChange={(e) => setNotes(e.target.value)} disabled={isPending} />
              </label>
            </div>
            {error && <p style={{ color: "var(--tone-danger, red)", marginTop: 8, fontSize: "0.85rem" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="button button--primary button--sm" onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </button>
              <button type="button" className="button button--ghost button--sm" onClick={() => setEditing(false)} disabled={isPending}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <dl className="data-list">
            <ReadRow label="Provider" value={warrantyDetails?.provider} />
            <ReadRow label="Policy Number" value={warrantyDetails?.policyNumber} />
            <ReadRow label="Coverage Type" value={warrantyDetails?.coverageType} />
            <ReadRow label="Start" value={formatDate(warrantyDetails?.startDate, "Not set", undefined, dateFormat)} />
            <ReadRow label="End" value={formatDate(warrantyDetails?.endDate, "Not set", undefined, dateFormat)} />
            <ReadRow label="Notes" value={warrantyDetails?.notes} />
          </dl>
        )}
      </div>
    </section>
  );
}

// ─── Location Details ────────────────────────────────────────────────────────

type SpaceLocation = {
  breadcrumb: { name: string }[];
} | null;

type AssetLocationDetailsCardProps = {
  assetId: string;
  householdId: string;
  locationDetails: LocationDetails | null;
  spaceLocation: SpaceLocation;
};

export function AssetLocationDetailsCard({
  assetId,
  householdId,
  locationDetails,
  spaceLocation,
}: AssetLocationDetailsCardProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [propertyName, setPropertyName] = useState(locationDetails?.propertyName ?? "");
  const [building, setBuilding] = useState(locationDetails?.building ?? "");
  const [room, setRoom] = useState(locationDetails?.room ?? "");
  const [latitude, setLatitude] = useState(locationDetails?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(locationDetails?.longitude?.toString() ?? "");
  const [notes, setNotes] = useState(locationDetails?.notes ?? "");

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const input: Partial<LocationDetails> = {};
      if (propertyName.trim()) input.propertyName = propertyName.trim();
      if (building.trim()) input.building = building.trim();
      if (room.trim()) input.room = room.trim();
      if (latitude.trim()) input.latitude = Number(latitude);
      if (longitude.trim()) input.longitude = Number(longitude);
      if (notes.trim()) input.notes = notes.trim();

      const result = await updateAssetFieldAction(assetId, householdId, {
        locationDetails: Object.keys(input).length > 0 ? input : undefined,
      });
      if (result.success) {
        setEditing(false);
      } else {
        setError(result.message);
      }
    });
  };

  const spaceDisplay = spaceLocation
    ? spaceLocation.breadcrumb.map((b) => b.name).join(" › ")
    : null;

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Location Details</h2>
        {!editing && (
          <button type="button" className="button button--ghost button--xs" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      <div className="panel__body--padded">
        {editing ? (
          <div>
            {spaceDisplay && (
              <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", marginBottom: 12 }}>
                Assigned Space: <strong>{spaceDisplay}</strong> (change in Advanced settings)
              </p>
            )}
            <div className="workbench-grid">
              <label className="field">
                <span>Property</span>
                <input type="text" className="input" value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)} disabled={isPending} />
              </label>
              <label className="field">
                <span>Building</span>
                <input type="text" className="input" value={building}
                  onChange={(e) => setBuilding(e.target.value)} disabled={isPending} />
              </label>
              <label className="field">
                <span>Room</span>
                <input type="text" className="input" value={room}
                  onChange={(e) => setRoom(e.target.value)} disabled={isPending} />
              </label>
              <label className="field">
                <span>Latitude</span>
                <input type="number" className="input" step="any" min="-90" max="90" value={latitude}
                  onChange={(e) => setLatitude(e.target.value)} disabled={isPending} />
              </label>
              <label className="field">
                <span>Longitude</span>
                <input type="number" className="input" step="any" min="-180" max="180" value={longitude}
                  onChange={(e) => setLongitude(e.target.value)} disabled={isPending} />
              </label>
              <label className="field field--full">
                <span>Notes</span>
                <textarea className="input" rows={3} value={notes}
                  onChange={(e) => setNotes(e.target.value)} disabled={isPending} />
              </label>
            </div>
            {error && <p style={{ color: "var(--tone-danger, red)", marginTop: 8, fontSize: "0.85rem" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="button button--primary button--sm" onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </button>
              <button type="button" className="button button--ghost button--sm" onClick={() => setEditing(false)} disabled={isPending}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <dl className="data-list">
            {spaceDisplay && <ReadRow label="Assigned Space" value={spaceDisplay} />}
            <ReadRow label="Property" value={locationDetails?.propertyName} />
            <ReadRow label="Building" value={locationDetails?.building} />
            <ReadRow label="Room" value={locationDetails?.room} />
            <ReadRow
              label="Coordinates"
              value={
                locationDetails?.latitude !== undefined && locationDetails?.longitude !== undefined
                  ? `${locationDetails.latitude}, ${locationDetails.longitude}`
                  : null
              }
            />
            <ReadRow label="Notes" value={locationDetails?.notes} />
          </dl>
        )}
      </div>
    </section>
  );
}

// ─── Insurance & Disposition ─────────────────────────────────────────────────

type AssetInsuranceDetailsCardProps = {
  assetId: string;
  householdId: string;
  insuranceDetails: InsuranceDetails | null;
  dispositionDetails: DispositionDetails | null;
  currencyCode: string;
  dateFormat: DateFormat;
};

export function AssetInsuranceDetailsCard({
  assetId,
  householdId,
  insuranceDetails,
  dispositionDetails,
  currencyCode,
  dateFormat,
}: AssetInsuranceDetailsCardProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Insurance fields
  const [insProvider, setInsProvider] = useState(insuranceDetails?.provider ?? "");
  const [insPolicyNumber, setInsPolicyNumber] = useState(insuranceDetails?.policyNumber ?? "");
  const [insCoverageAmount, setInsCoverageAmount] = useState(insuranceDetails?.coverageAmount?.toString() ?? "");
  const [insDeductible, setInsDeductible] = useState(insuranceDetails?.deductible?.toString() ?? "");
  const [insRenewalDate, setInsRenewalDate] = useState(toDateInputValue(insuranceDetails?.renewalDate));
  const [insNotes, setInsNotes] = useState(insuranceDetails?.notes ?? "");

  // Disposition fields
  const [dispMethod, setDispMethod] = useState(dispositionDetails?.method ?? "");
  const [dispDate, setDispDate] = useState(toDateInputValue(dispositionDetails?.date));
  const [dispSalePrice, setDispSalePrice] = useState(dispositionDetails?.salePrice?.toString() ?? "");
  const [dispBuyerInfo, setDispBuyerInfo] = useState(dispositionDetails?.buyerInfo ?? "");
  const [dispNotes, setDispNotes] = useState(dispositionDetails?.notes ?? "");

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const insInput: Partial<InsuranceDetails> = {};
      if (insProvider.trim()) insInput.provider = insProvider.trim();
      if (insPolicyNumber.trim()) insInput.policyNumber = insPolicyNumber.trim();
      if (insCoverageAmount.trim()) insInput.coverageAmount = Number(insCoverageAmount);
      if (insDeductible.trim()) insInput.deductible = Number(insDeductible);
      const renewalIso = fromDateInputValue(insRenewalDate);
      if (renewalIso) insInput.renewalDate = renewalIso;
      if (insNotes.trim()) insInput.notes = insNotes.trim();

      const dispInput: Partial<DispositionDetails> = {};
      if (dispMethod) dispInput.method = dispMethod as DispositionDetails["method"];
      const dispIso = fromDateInputValue(dispDate);
      if (dispIso) dispInput.date = dispIso;
      if (dispSalePrice.trim()) dispInput.salePrice = Number(dispSalePrice);
      if (dispBuyerInfo.trim()) dispInput.buyerInfo = dispBuyerInfo.trim();
      if (dispNotes.trim()) dispInput.notes = dispNotes.trim();

      const result = await updateAssetFieldAction(assetId, householdId, {
        insuranceDetails: Object.keys(insInput).length > 0 ? insInput : undefined,
        dispositionDetails: Object.keys(dispInput).length > 0 ? dispInput : undefined,
      });
      if (result.success) {
        setEditing(false);
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Insurance &amp; Disposition</h2>
        {!editing && (
          <button type="button" className="button button--ghost button--xs" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      <div className="panel__body--padded">
        {editing ? (
          <div>
            <p style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-muted)", marginBottom: 10 }}>
              Insurance
            </p>
            <div className="workbench-grid" style={{ marginBottom: 20 }}>
              <label className="field">
                <span>Provider</span>
                <input type="text" className="input" value={insProvider}
                  onChange={(e) => setInsProvider(e.target.value)} disabled={isPending} />
              </label>
              <label className="field">
                <span>Policy Number</span>
                <input type="text" className="input" value={insPolicyNumber}
                  onChange={(e) => setInsPolicyNumber(e.target.value)} disabled={isPending} />
              </label>
              <label className="field">
                <span>Coverage Amount</span>
                <input type="number" className="input" min="0" step="0.01" value={insCoverageAmount}
                  onChange={(e) => setInsCoverageAmount(e.target.value)} disabled={isPending} />
              </label>
              <label className="field">
                <span>Deductible</span>
                <input type="number" className="input" min="0" step="0.01" value={insDeductible}
                  onChange={(e) => setInsDeductible(e.target.value)} disabled={isPending} />
              </label>
              <label className="field">
                <span>Renewal Date</span>
                <input type="date" className="input" value={insRenewalDate}
                  onChange={(e) => setInsRenewalDate(e.target.value)} disabled={isPending} />
              </label>
              <label className="field field--full">
                <span>Notes</span>
                <textarea className="input" rows={2} value={insNotes}
                  onChange={(e) => setInsNotes(e.target.value)} disabled={isPending} />
              </label>
            </div>
            <p style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-muted)", marginBottom: 10 }}>
              Disposition
            </p>
            <div className="workbench-grid">
              <label className="field">
                <span>Method</span>
                <select className="input" value={dispMethod}
                  onChange={(e) => setDispMethod(e.target.value)} disabled={isPending}>
                  <option value="">— not set —</option>
                  <option value="sold">Sold</option>
                  <option value="donated">Donated</option>
                  <option value="scrapped">Scrapped</option>
                  <option value="recycled">Recycled</option>
                  <option value="lost">Lost</option>
                </select>
              </label>
              <label className="field">
                <span>Date</span>
                <input type="date" className="input" value={dispDate}
                  onChange={(e) => setDispDate(e.target.value)} disabled={isPending} />
              </label>
              <label className="field">
                <span>Sale Price</span>
                <input type="number" className="input" min="0" step="0.01" value={dispSalePrice}
                  onChange={(e) => setDispSalePrice(e.target.value)} disabled={isPending} />
              </label>
              <label className="field field--full">
                <span>Buyer Info</span>
                <input type="text" className="input" value={dispBuyerInfo}
                  onChange={(e) => setDispBuyerInfo(e.target.value)} disabled={isPending} />
              </label>
              <label className="field field--full">
                <span>Notes</span>
                <textarea className="input" rows={2} value={dispNotes}
                  onChange={(e) => setDispNotes(e.target.value)} disabled={isPending} />
              </label>
            </div>
            {error && <p style={{ color: "var(--tone-danger, red)", marginTop: 8, fontSize: "0.85rem" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="button button--primary button--sm" onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </button>
              <button type="button" className="button button--ghost button--sm" onClick={() => setEditing(false)} disabled={isPending}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <dl className="data-list">
            <ReadRow label="Insurance Provider" value={insuranceDetails?.provider} />
            <ReadRow label="Policy Number" value={insuranceDetails?.policyNumber} />
            <ReadRow label="Coverage Amount" value={insuranceDetails?.coverageAmount !== undefined ? formatCurrency(insuranceDetails.coverageAmount, "—", currencyCode) : null} />
            <ReadRow label="Deductible" value={insuranceDetails?.deductible !== undefined ? formatCurrency(insuranceDetails.deductible, "—", currencyCode) : null} />
            <ReadRow label="Renewal Date" value={formatDate(insuranceDetails?.renewalDate, "Not set", undefined, dateFormat)} />
            <ReadRow label="Disposition Method" value={dispositionDetails?.method ?? null} />
            <ReadRow label="Disposition Date" value={formatDate(dispositionDetails?.date, "Not set", undefined, dateFormat)} />
            <ReadRow label="Sale Price" value={dispositionDetails?.salePrice !== undefined ? formatCurrency(dispositionDetails.salePrice, "—", currencyCode) : null} />
            <ReadRow label="Buyer Info" value={dispositionDetails?.buyerInfo} />
          </dl>
        )}
      </div>
    </section>
  );
}

// ─── Profile Fields ──────────────────────────────────────────────────────────

type AssetProfileFieldsCardProps = {
  assetId: string;
  householdId: string;
  fieldDefinitions: AssetFieldDefinition[];
  customFields: Record<string, AssetFieldValue>;
};

function renderFieldValue(value: AssetFieldValue): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function AssetProfileFieldsCard({
  assetId,
  householdId,
  fieldDefinitions,
  customFields,
}: AssetProfileFieldsCardProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local draft state — one entry per field key
  const [draft, setDraft] = useState<Record<string, AssetFieldValue>>(() => {
    const init: Record<string, AssetFieldValue> = {};
    for (const def of fieldDefinitions) {
      const v = customFields[def.key];
      init[def.key] = v !== undefined ? v : (def.defaultValue ?? null);
    }
    return init;
  });

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateAssetFieldAction(assetId, householdId, {
        customFields: draft,
      });
      if (result.success) {
        setEditing(false);
      } else {
        setError(result.message);
      }
    });
  };

  const handleCancel = () => {
    // Reset draft to last saved values
    const reset: Record<string, AssetFieldValue> = {};
    for (const def of fieldDefinitions) {
      const v = customFields[def.key];
      reset[def.key] = v !== undefined ? v : (def.defaultValue ?? null);
    }
    setDraft(reset);
    setError(null);
    setEditing(false);
  };

  const setField = (key: string, value: AssetFieldValue) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  if (fieldDefinitions.length === 0) {
    return (
      <section className="panel">
        <div className="panel__header">
          <h2>Profile Fields</h2>
        </div>
        <div className="panel__body--padded">
          <p className="panel__empty">No custom profile fields defined.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Profile Fields</h2>
        {!editing && (
          <button type="button" className="button button--ghost button--xs" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      <div className="panel__body--padded">
        {editing ? (
          <div>
            <div className="workbench-grid">
              {fieldDefinitions.map((def) => {
                const value = draft[def.key];

                if (def.type === "boolean") {
                  const boolVal = typeof value === "boolean" ? value : null;
                  return (
                    <label key={def.key} className={`field${def.wide ? " field--full" : ""}`}>
                      <span>{def.label}</span>
                      <select
                        className="input"
                        value={boolVal === null ? "" : boolVal ? "true" : "false"}
                        onChange={(e) => {
                          const v = e.target.value;
                          setField(def.key, v === "" ? null : v === "true");
                        }}
                        disabled={isPending}
                      >
                        <option value="">— not set —</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </label>
                  );
                }

                if (def.type === "select") {
                  return (
                    <label key={def.key} className={`field${def.wide ? " field--full" : ""}`}>
                      <span>{def.label}</span>
                      <select
                        className="input"
                        value={typeof value === "string" ? value : ""}
                        onChange={(e) => setField(def.key, e.target.value || null)}
                        disabled={isPending}
                      >
                        <option value="">— not set —</option>
                        {def.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                  );
                }

                if (def.type === "multiselect") {
                  const selected = Array.isArray(value) ? value : [];
                  return (
                    <fieldset key={def.key} className={`field${def.wide ? " field--full" : ""}`} style={{ border: "none", padding: 0, margin: 0 }}>
                      <legend style={{ fontSize: "0.82rem", fontWeight: 500, marginBottom: "6px" }}>{def.label}</legend>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {def.options.map((opt) => (
                          <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.9rem" }}>
                            <input
                              type="checkbox"
                              checked={selected.includes(opt.value)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...selected, opt.value]
                                  : selected.filter((v) => v !== opt.value);
                                setField(def.key, next.length > 0 ? next : null);
                              }}
                              disabled={isPending}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  );
                }

                if (def.type === "textarea") {
                  return (
                    <label key={def.key} className="field field--full">
                      <span>{def.label}</span>
                      <textarea
                        className="input"
                        rows={3}
                        placeholder={def.placeholder ?? ""}
                        value={typeof value === "string" ? value : ""}
                        onChange={(e) => setField(def.key, e.target.value || null)}
                        disabled={isPending}
                      />
                    </label>
                  );
                }

                if (def.type === "date") {
                  return (
                    <label key={def.key} className={`field${def.wide ? " field--full" : ""}`}>
                      <span>{def.label}</span>
                      <input
                        type="date"
                        className="input"
                        value={typeof value === "string" ? toDateInputValue(value) : ""}
                        onChange={(e) => setField(def.key, e.target.value ? fromDateInputValue(e.target.value) ?? null : null)}
                        disabled={isPending}
                      />
                    </label>
                  );
                }

                if (def.type === "number" || def.type === "currency") {
                  return (
                    <label key={def.key} className={`field${def.wide ? " field--full" : ""}`}>
                      <span>{def.label}{def.unit ? ` (${def.unit})` : ""}</span>
                      <input
                        type="number"
                        className="input"
                        step={def.type === "currency" ? "0.01" : "any"}
                        placeholder={def.placeholder ?? ""}
                        value={typeof value === "number" ? value : ""}
                        onChange={(e) => setField(def.key, e.target.value !== "" ? Number(e.target.value) : null)}
                        disabled={isPending}
                      />
                    </label>
                  );
                }

                // string, url — default text input
                return (
                  <label key={def.key} className={`field${def.wide ? " field--full" : ""}`}>
                    <span>{def.label}{def.unit ? ` (${def.unit})` : ""}</span>
                    <input
                      type={def.type === "url" ? "url" : "text"}
                      className="input"
                      placeholder={def.placeholder ?? ""}
                      value={typeof value === "string" ? value : ""}
                      onChange={(e) => setField(def.key, e.target.value || null)}
                      disabled={isPending}
                    />
                  </label>
                );
              })}
            </div>
            {error && <p style={{ color: "var(--tone-danger, red)", marginTop: 8, fontSize: "0.85rem" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="button button--primary button--sm" onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </button>
              <button type="button" className="button button--ghost button--sm" onClick={handleCancel} disabled={isPending}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <dl className="data-list">
            {fieldDefinitions.map((def) => (
              <div key={def.key}>
                <dt>{def.label}{def.unit ? ` (${def.unit})` : ""}</dt>
                <dd style={{ color: !customFields[def.key] && customFields[def.key] !== false && customFields[def.key] !== 0 ? "var(--ink-muted)" : undefined }}>
                  {renderFieldValue(customFields[def.key] ?? null)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
