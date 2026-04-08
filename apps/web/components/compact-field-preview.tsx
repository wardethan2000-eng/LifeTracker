import type { AssetFieldDefinition } from "@aegis/types";
import { CompactPreview } from "./compact-preview";

type CompactFieldPreviewProps = {
  fieldDefinitions: AssetFieldDefinition[];
};

export function CompactFieldPreview({ fieldDefinitions }: CompactFieldPreviewProps): JSX.Element {
  const sections = Array.from(
    new Set(
      fieldDefinitions
        .map((f) => f.group?.trim())
        .filter((g): g is string => Boolean(g))
    )
  );
  const unsectionedCount = fieldDefinitions.filter((f) => !f.group?.trim()).length;
  const totalCount = fieldDefinitions.length;

  if (totalCount === 0) {
    return <CompactPreview items={[]} layout="pill" emptyMessage="Click to define custom fields" emptyAction />;
  }

  return (
    <CompactPreview
      layout="pill"
      items={[
        ...sections.map((section) => ({ id: section, label: section })),
        ...(unsectionedCount > 0 ? [{ id: "general", label: `General (${unsectionedCount})` }] : []),
      ]}
      summary={
        <>
          {totalCount} field{totalCount !== 1 ? "s" : ""}
          {sections.length > 0 ? ` across ${sections.length + (unsectionedCount > 0 ? 1 : 0)} section${sections.length > 1 || unsectionedCount > 0 ? "s" : ""}` : ""}
        </>
      }
      emptyMessage="Click to define custom fields"
      emptyAction
    />
  );
}
