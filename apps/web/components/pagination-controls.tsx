import Link from "next/link";
import type { JSX } from "react";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

// ─── Cursor-Based Pagination ────────────────────────────────────────────────

type CursorPaginationControlsProps = {
  nextCursor: string | null;
  currentCursor: string | undefined;
  cursorHistory: string[];
  limit: number;
  resultCount: number;
  entityLabel?: string;
  buildHref: (params: { cursor?: string; history?: string[]; limit: number }) => string;
};

export function CursorPaginationControls({
  nextCursor,
  currentCursor: _currentCursor,
  cursorHistory,
  limit,
  resultCount,
  entityLabel,
  buildHref,
}: CursorPaginationControlsProps): JSX.Element {
  const previousCursor = cursorHistory.length > 0 ? cursorHistory[cursorHistory.length - 1] : undefined;
  const previousHistory = cursorHistory.slice(0, -1);
  const nextHistory = _currentCursor ? [...cursorHistory, _currentCursor] : cursorHistory;

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Pagination</h2>
        <span className="pill">Showing {resultCount}{entityLabel ? ` ${entityLabel}` : " on this page"}</span>
      </div>
      <div
        className="panel__body--padded"
        style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}
      >
        <div className="data-table__secondary">
          Cursor-based pages keep the order stable while filters stay applied.
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <span className="data-table__secondary" style={{ whiteSpace: "nowrap" }}>
            Per page:{" "}
            {PAGE_SIZE_OPTIONS.map((size, index) => (
              <span key={size}>
                {index > 0 && <span style={{ opacity: 0.4 }}> / </span>}
                {size === limit ? (
                  <strong>{size}</strong>
                ) : (
                  <Link href={buildHref({ limit: size })} className="text-link">
                    {size}
                  </Link>
                )}
              </span>
            ))}
          </span>
          <div className="inline-actions">
            {previousCursor ? (
              <Link
                href={buildHref({ cursor: previousCursor, history: previousHistory, limit })}
                className="button button--ghost"
              >
                Previous Page
              </Link>
            ) : null}
            {nextCursor ? (
              <Link
                href={buildHref({ cursor: nextCursor, history: nextHistory, limit })}
                className="button button--primary"
              >
                Next Page
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Offset-Based Pagination ─────────────────────────────────────────────────

type OffsetPaginationControlsProps = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  entityLabel?: string;
  buildHref: (params: { offset: number; limit: number }) => string;
};

export function OffsetPaginationControls({
  total,
  limit,
  offset,
  hasMore,
  entityLabel,
  buildHref,
}: OffsetPaginationControlsProps): JSX.Element {
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + limit, total);

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Pagination</h2>
        <span className="pill">
          {total === 0
            ? "No results"
            : `Showing ${rangeStart}\u2013${rangeEnd} of ${total}${entityLabel ? ` ${entityLabel}` : ""}`}
        </span>
      </div>
      <div
        className="panel__body--padded"
        style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}
      >
        <div className="data-table__secondary">{total} {entityLabel ?? "total results"}</div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <span className="data-table__secondary" style={{ whiteSpace: "nowrap" }}>
            Per page:{" "}
            {PAGE_SIZE_OPTIONS.map((size, index) => (
              <span key={size}>
                {index > 0 && <span style={{ opacity: 0.4 }}> / </span>}
                {size === limit ? (
                  <strong>{size}</strong>
                ) : (
                  <Link href={buildHref({ offset: 0, limit: size })} className="text-link">
                    {size}
                  </Link>
                )}
              </span>
            ))}
          </span>
          <div className="inline-actions">
            {offset > 0 ? (
              <Link
                href={buildHref({ offset: Math.max(0, offset - limit), limit })}
                className="button button--ghost"
              >
                Previous Page
              </Link>
            ) : null}
            {hasMore ? (
              <Link
                href={buildHref({ offset: offset + limit, limit })}
                className="button button--primary"
              >
                Next Page
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
