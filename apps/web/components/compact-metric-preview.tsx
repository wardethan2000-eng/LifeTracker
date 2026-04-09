import type { PresetUsageMetricTemplate } from "@aegis/types";
import { CompactPreview } from "./compact-preview";

type CompactMetricPreviewProps = {
  metricTemplates: PresetUsageMetricTemplate[];
};

export function CompactMetricPreview({ metricTemplates }: CompactMetricPreviewProps): JSX.Element {
  const count = metricTemplates.length;
  const preview = metricTemplates.slice(0, 4);

  if (count === 0) {
    return <CompactPreview items={[]} layout="table" emptyMessage="Click to define usage metrics" emptyAction />;
  }

  return (
    <CompactPreview
      layout="table"
      headers={["Metric", "Unit"]}
      summary={`${count} metric${count !== 1 ? "s" : ""} tracked`}
      items={preview.map((template, index) => ({
        id: `${template.key}-${index}`,
        label: template.name,
        value: template.unit ?? "—",
        tone: template.unit ? "default" : "muted",
      }))}
      overflowMessage={count > 4 ? `+${count - 4} more…` : undefined}
      emptyMessage="Click to define usage metrics"
    />
  );
}
