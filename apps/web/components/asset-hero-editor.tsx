"use client";

import type { Asset } from "@aegis/types";
import type { JSX } from "react";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAssetFieldAction } from "../app/actions";
import { ClickToEdit } from "./click-to-edit";

type AssetHeroEditorProps = {
  asset: Pick<Asset, "id" | "householdId" | "name" | "manufacturer" | "model" | "description" | "serialNumber">;
};

export function AssetHeroEditor({ asset }: AssetHeroEditorProps): JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(asset.name);
  const [manufacturer, setManufacturer] = useState(asset.manufacturer ?? "");
  const [model, setModel] = useState(asset.model ?? "");
  const [description, setDescription] = useState(asset.description ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const save = useCallback(
    (patch: Parameters<typeof updateAssetFieldAction>[2]) => {
      setSaveState("saving");
      setErrorMsg(null);
      startTransition(async () => {
        const result = await updateAssetFieldAction(asset.id, asset.householdId, patch);
        if (result.success) {
          setSaveState("saved");
          router.refresh();
          setTimeout(() => setSaveState("idle"), 1800);
        } else {
          setSaveState("error");
          setErrorMsg(result.message);
        }
      });
    },
    [asset.id, asset.householdId, router]
  );

  return (
    <div className="asset-hero-editor">
      <div className="asset-hero-editor__name">
        <ClickToEdit
          value={name}
          onSave={(v) => {
            if (v.trim()) {
              setName(v);
              save({ name: v });
            }
          }}
          placeholder="Asset name"
          required
          className="asset-hero-editor__name-field"
          aria-label="Edit asset name"
          disabled={isPending}
        />
      </div>

      <div className="asset-hero-editor__identity">
        <ClickToEdit
          value={manufacturer}
          onSave={(v) => {
            setManufacturer(v);
            save({ manufacturer: v || undefined });
          }}
          placeholder="Manufacturer"
          className="asset-hero-editor__meta-field"
          aria-label="Edit manufacturer"
          disabled={isPending}
        />
        {(manufacturer || model) && (
          <span className="asset-hero-editor__sep" aria-hidden="true">·</span>
        )}
        <ClickToEdit
          value={model}
          onSave={(v) => {
            setModel(v);
            save({ model: v || undefined });
          }}
          placeholder="Model"
          className="asset-hero-editor__meta-field"
          aria-label="Edit model"
          disabled={isPending}
        />
      </div>

      {(description || true) && (
        <div className="asset-hero-editor__description">
          <ClickToEdit
            value={description}
            onSave={(v) => {
              setDescription(v);
              save({ description: v || undefined });
            }}
            as="textarea"
            placeholder="Add a description…"
            className="asset-hero-editor__description-field"
            aria-label="Edit description"
            disabled={isPending}
          />
        </div>
      )}

      <div className="asset-hero-editor__status" aria-live="polite">
        {saveState === "saving" && (
          <span className="asset-hero-editor__saving">Saving…</span>
        )}
        {saveState === "saved" && (
          <span className="asset-hero-editor__saved">✓ Saved</span>
        )}
        {saveState === "error" && errorMsg && (
          <span className="asset-hero-editor__error">{errorMsg}</span>
        )}
      </div>
    </div>
  );
}
