import type { ReactNode } from "react";

export type CompactPreviewTone = "default" | "muted" | "danger";

export type CompactPreviewItem = {
  id: string;
  label: ReactNode;
  value?: ReactNode;
  tone?: CompactPreviewTone;
};

type CompactPreviewProps = {
  items: CompactPreviewItem[];
  layout: "pill" | "table";
  summary?: ReactNode;
  emptyMessage: ReactNode;
  emptyAction?: boolean;
  overflowMessage?: ReactNode;
  headers?: [ReactNode, ReactNode?];
  ariaLabel?: string;
};

const toneClassName = (tone: CompactPreviewTone | undefined): string => {
  switch (tone) {
    case "muted":
      return " compact-preview__tone--muted";
    case "danger":
      return " compact-preview__tone--danger";
    default:
      return "";
  }
};

export function CompactPreview({
  items,
  layout,
  summary,
  emptyMessage,
  emptyAction = false,
  overflowMessage,
  headers,
  ariaLabel,
}: CompactPreviewProps): JSX.Element {
  if (items.length === 0) {
    return (
      <div className="compact-preview">
        <p className={`compact-preview__empty${emptyAction ? " compact-preview__empty--action" : ""}`}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="compact-preview">
      {summary ? <p className="compact-preview__summary">{summary}</p> : null}

      {layout === "pill" ? (
        <div className="compact-preview__pills">
          {items.map((item) => (
            <span key={item.id} className={`compact-preview__pill${toneClassName(item.tone)}`}>
              {item.label}
            </span>
          ))}
        </div>
      ) : (
        <table className="compact-preview__mini-table" aria-label={ariaLabel}>
          {headers ? (
            <thead>
              <tr>
                <th>{headers[0]}</th>
                <th>{headers[1] ?? "Value"}</th>
              </tr>
            </thead>
          ) : null}
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.label}</td>
                <td>
                  <span className={`compact-preview__value${toneClassName(item.tone)}`}>
                    {item.value ?? "-"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {overflowMessage ? <p className="compact-preview__overflow">{overflowMessage}</p> : null}
    </div>
  );
}