import type { Asset, AssetCategory } from "@lifekeeper/types";
import type { JSX } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { AssetProfileFormValues } from "../lib/validation/forms";
import { Card } from "./card";
import { InlineError } from "./inline-error";

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
  register: UseFormRegister<AssetProfileFormValues>;
  errors: FieldErrors<AssetProfileFormValues>;
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
  register,
  errors,
  onCategoryChange,
  onBlueprintChange,
}: CoreIdentitySectionProps): JSX.Element {
  return (
    <Card title="Core Identity">
      <div className="workbench-grid">
        <label className="field field--full">
          <span>Asset Name *</span>
          <input type="text" placeholder='e.g. "Riding Mower", "Family SUV"' {...register("name")} />
          <InlineError message={errors.name?.message} size="sm" />
        </label>

        <label className="field">
          <span>Category</span>
          <select
            value={category}
            {...register("category")}
            onChange={(event) => {
              register("category").onChange(event);
              onCategoryChange(event.target.value as AssetCategory);
            }}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <InlineError message={errors.category?.message} size="sm" />
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
          <input type="text" placeholder='e.g. "Honda", "Samsung"' {...register("manufacturer")} />
          <InlineError message={errors.manufacturer?.message} size="sm" />
        </label>
        <label className="field">
          <span>Model</span>
          <input type="text" placeholder='e.g. "HRX217"' {...register("model")} />
          <InlineError message={errors.model?.message} size="sm" />
        </label>
        <label className="field">
          <span>Serial Number</span>
          <input type="text" placeholder="For warranty claims" {...register("serialNumber")} />
          <InlineError message={errors.serialNumber?.message} size="sm" />
        </label>
        <label className="field">
          <span>Parent Asset</span>
          <select {...register("parentAssetId")}>
            <option value="">No parent asset</option>
            {availableParentAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.name}</option>
            ))}
          </select>
          <InlineError message={errors.parentAssetId?.message} size="sm" />
        </label>
        <label className="field field--full">
          <span>Description & Notes</span>
          <textarea rows={3} placeholder="Anything helpful..." {...register("description")} />
          <InlineError message={errors.description?.message} size="sm" />
        </label>
      </div>
    </Card>
  );
}