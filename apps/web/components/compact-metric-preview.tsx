import type { PresetUsageMetricTemplate } from "@lifekeeper/types";

type CompactMetricPreviewProps = {
  metricTemplates: PresetUsageMetricTemplate[];
};

export function CompactMetricPreview({ metricTemplates }: CompactMetricPreviewProps): JSX.Element {
  const count = metricTemplates.length;
  const preview = metricTemplates.slice(0, 4);

  if (count === 0) {
    return (
      <div className="compact-preview">
        <p className="compact-preview__empty compact-preview__empty--action">Click to define usage metrics</p>
      </div>
    );
  }

  return (
    <div className="compact-preview">
      <p className="compact-preview__summary">
        {count} metric{count !== 1 ? "s" : ""} tracked
      </p>
      <table className="compact-preview__mini-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          {preview.map((template, i) => (
            <tr key={i}>
              <td>{template.name}</td>
              <td style={{ color: "var(--ink-muted)" }}>{template.unit ?? "—"}</td>
            </tr>
          ))}
          {count > 4 ? (
            <tr>
              <td colSpan={2} style={{ color: "var(--ink-muted)", fontStyle: "italic" }}>
                +{count - 4} more…
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
