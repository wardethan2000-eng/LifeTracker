import type { PresetScheduleTemplate } from "@lifekeeper/types";
import { CompactPreview } from "./compact-preview";

type CompactSchedulePreviewProps = {
  scheduleTemplates: PresetScheduleTemplate[];
};

function triggerSummary(template: PresetScheduleTemplate): string {
  const t = template.triggerTemplate;
  if (t.type === "interval") {
    return `Every ${t.intervalDays}d`;
  }
  if (t.type === "usage") {
    return `Every ${t.intervalValue.toLocaleString()} ${t.metricKey}`;
  }
  if (t.type === "seasonal") {
    return `Seasonal`;
  }
  if (t.type === "compound") {
    return `Every ${t.intervalDays}d or ${t.intervalValue} ${t.metricKey}`;
  }
  return t.type;
}

export function CompactSchedulePreview({ scheduleTemplates }: CompactSchedulePreviewProps): JSX.Element {
  const count = scheduleTemplates.length;
  const preview = scheduleTemplates.slice(0, 4);

  if (count === 0) {
    return <CompactPreview items={[]} layout="table" emptyMessage="Click to define maintenance schedules" emptyAction />;
  }

  return (
    <CompactPreview
      layout="table"
      headers={["Name", "Trigger"]}
      summary={`${count} schedule${count !== 1 ? "s" : ""} from template`}
      items={preview.map((template, index) => ({
        id: `${template.key}-${index}`,
        label: template.name,
        value: triggerSummary(template),
        tone: "muted",
      }))}
      overflowMessage={count > 4 ? `+${count - 4} more…` : undefined}
      emptyMessage="Click to define maintenance schedules"
    />
  );
}
