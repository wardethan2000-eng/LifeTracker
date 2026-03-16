import type { AssetFieldDefinition } from "@lifekeeper/types";

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
    return (
      <div className="compact-preview">
        <p className="compact-preview__empty compact-preview__empty--action">Click to define custom fields</p>
      </div>
    );
  }

  return (
    <div className="compact-preview">
      <p className="compact-preview__summary">
        {totalCount} field{totalCount !== 1 ? "s" : ""}
        {sections.length > 0 ? ` across ${sections.length + (unsectionedCount > 0 ? 1 : 0)} section${sections.length > 1 || unsectionedCount > 0 ? "s" : ""}` : ""}
      </p>
      {sections.length > 0 ? (
        <div className="compact-preview__pills">
          {sections.map((section) => (
            <span key={section} className="compact-preview__pill">{section}</span>
          ))}
          {unsectionedCount > 0 ? (
            <span className="compact-preview__pill">General ({unsectionedCount})</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
