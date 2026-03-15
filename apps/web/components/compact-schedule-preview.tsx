import type { PresetScheduleTemplate } from "@lifekeeper/types";

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
    return (
      <div className="compact-preview">
        <p className="compact-preview__empty">No maintenance schedules configured.</p>
      </div>
    );
  }

  return (
    <div className="compact-preview">
      <p className="compact-preview__summary">
        {count} schedule{count !== 1 ? "s" : ""} from template
      </p>
      <table className="compact-preview__mini-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Trigger</th>
          </tr>
        </thead>
        <tbody>
          {preview.map((template, i) => (
            <tr key={i}>
              <td>{template.name}</td>
              <td style={{ color: "var(--ink-muted)" }}>{triggerSummary(template)}</td>
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
