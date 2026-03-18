import type { Asset, AssetCategory } from "@lifekeeper/types";
import type { JSX } from "react";
import { Card } from "./card";

type BlueprintOption = {
  id: string;
  label: string;
  description?: string | undefined;
};

type CategoryOption = {
  value: AssetCategory;
  label: string;
};

type CoreIdentitySectionProps = {
  initialAsset: Asset | undefined;
  category: AssetCategory;
  templateLabel: string;
  templateDescription: string;
  selectedBlueprintId: string;
  selectedBlueprint: BlueprintOption | undefined;
  categoryOptions: CategoryOption[];
  categoryLibraryBlueprints: BlueprintOption[];
  categoryCustomBlueprints: BlueprintOption[];
  availableParentAssets: Asset[];
  onCategoryChange: (nextCategory: AssetCategory) => void;
  onBlueprintChange: (nextId: string) => void;
};

export function AssetProfileWorkbenchCoreIdentitySection({
  initialAsset,
  category,
  templateLabel,
  templateDescription,
  selectedBlueprintId,
  selectedBlueprint,
  categoryOptions,
  categoryLibraryBlueprints,
  categoryCustomBlueprints,
  availableParentAssets,
  onCategoryChange,
  onBlueprintChange,
}: CoreIdentitySectionProps): JSX.Element {
  return (
    <Card title="Core Identity">
      <div className="workbench-grid">
        <label className="field field--full">
          <span>Asset Name *</span>
          <input type="text" name="name" defaultValue={initialAsset?.name ?? ""} placeholder='e.g. "Riding Mower", "Family SUV"' required />
        </label>

        <label className="field">
          <span>Category</span>
          <select name="category" value={category} onChange={(event) => onCategoryChange(event.target.value as AssetCategory)}>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{templateLabel}</span>
          <select value={selectedBlueprintId} onChange={(event) => onBlueprintChange(event.target.value)}>
            <option value="">None (blank)</option>
            {categoryLibraryBlueprints.length > 0 ? (
              <optgroup label="Built-in Templates">
                {categoryLibraryBlueprints.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </optgroup>
            ) : null}
            {categoryCustomBlueprints.length > 0 ? (
              <optgroup label="My Templates">
                {categoryCustomBlueprints.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </optgroup>
            ) : null}
          </select>
          {selectedBlueprint ? <small>{templateDescription}</small> : null}
        </label>

        <label className="field">
          <span>Manufacturer / Brand</span>
          <input type="text" name="manufacturer" defaultValue={initialAsset?.manufacturer ?? ""} placeholder='e.g. "Honda", "Samsung"' />
        </label>
        <label className="field">
          <span>Model</span>
          <input type="text" name="model" defaultValue={initialAsset?.model ?? ""} placeholder='e.g. "HRX217"' />
        </label>
        <label className="field">
          <span>Serial Number</span>
          <input type="text" name="serialNumber" defaultValue={initialAsset?.serialNumber ?? ""} placeholder="For warranty claims" />
        </label>
        <label className="field">
          <span>Parent Asset</span>
          <select name="parentAssetId" defaultValue={initialAsset?.parentAssetId ?? ""}>
            <option value="">No parent asset</option>
            {availableParentAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.name}</option>
            ))}
          </select>
        </label>
        <label className="field field--full">
          <span>Description & Notes</span>
          <textarea name="description" rows={3} defaultValue={initialAsset?.description ?? ""} placeholder="Anything helpful..." />
        </label>
      </div>
    </Card>
  );
}