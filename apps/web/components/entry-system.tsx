"use client";

import type {
  ActionableEntryGroup,
  CreateEntryInput,
  Entry,
  EntryEntityType,
  EntryFlag,
  EntryMeasurement,
  EntrySurfaceQuery,
  EntryType,
  UpdateEntryInput
} from "@lifekeeper/types";
import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type JSX,
  type ReactNode
} from "react";
import {
  createEntry,
  deleteEntry,
  getActionableEntries,
  getEntries,
  getSurfacedEntries,
  updateEntry
} from "../lib/api";

type EntryEditorProps = {
  householdId: string;
  entityType: EntryEntityType;
  entityId: string;
  relatedEntries?: Entry[];
  initialEntry?: Entry;
  onSaved?: (entry: Entry, mode: "create" | "update") => void;
  onCancel?: () => void;
  submitLabel?: string;
  chrome?: "inline" | "modal";
};

type EntryTimelineProps = {
  householdId: string;
  entityType: EntryEntityType;
  entityId: string;
  title?: string;
  emptyMessage?: string;
  quickAddLabel?: string;
  initialComposerOpen?: boolean;
  entryHrefBuilder?: (entry: Entry) => string;
};

type EntryTipsSurfaceProps = {
  householdId: string;
  queries: EntrySurfaceQuery[];
  title?: string;
  entryHrefBuilder?: (entry: Entry) => string;
  defaultOpen?: boolean;
};

type EntryActionableListProps = {
  householdId: string;
  title?: string;
  compact?: boolean;
  entryHrefBuilder?: (entry: Entry) => string;
};

type EntryDraft = {
  title: string;
  body: string;
  entryDate: string;
  entryType: EntryType;
  flags: EntryFlag[];
  tags: string[];
  attachmentUrl: string;
  attachmentName: string;
  measurements: EntryMeasurement[];
};

type TrendSeries = {
  key: string;
  label: string;
  unit: string;
  points: Array<{ date: string; value: number }>;
};

const entryTypeOptions: Array<{ value: EntryType; label: string; shortLabel: string; tone: "neutral" | "accent" | "warning" | "info" }> = [
  { value: "note", label: "Note", shortLabel: "Note", tone: "neutral" },
  { value: "observation", label: "Observation", shortLabel: "Obs", tone: "accent" },
  { value: "measurement", label: "Measurement", shortLabel: "Measure", tone: "info" },
  { value: "lesson", label: "Lesson", shortLabel: "Lesson", tone: "accent" },
  { value: "decision", label: "Decision", shortLabel: "Decision", tone: "neutral" },
  { value: "issue", label: "Issue", shortLabel: "Issue", tone: "warning" },
  { value: "milestone", label: "Milestone", shortLabel: "Milestone", tone: "accent" },
  { value: "reference", label: "Reference", shortLabel: "Reference", tone: "info" },
  { value: "comparison", label: "Comparison", shortLabel: "Compare", tone: "neutral" }
] as const;

const entryTypeLabels = Object.fromEntries(entryTypeOptions.map((option) => [option.value, option.label])) as Record<EntryType, string>;

const flagOptions: Array<{ value: EntryFlag; label: string; tone: "accent" | "warning" | "info" | "muted" | "danger" | "success"; help: string }> = [
  { value: "important", label: "Important", tone: "accent", help: "Keeps high-value notes visually highlighted in the timeline." },
  { value: "pinned", label: "Pinned", tone: "info", help: "Pinned entries stay at the top of the timeline." },
  { value: "tip", label: "Tip", tone: "success", help: "Tips are surfaced when you start new sessions." },
  { value: "warning", label: "Warning", tone: "warning", help: "Warnings appear as alerts on related activities." },
  { value: "actionable", label: "Actionable", tone: "danger", help: "Marks an entry as something that still needs follow-up." },
  { value: "resolved", label: "Resolved", tone: "success", help: "Only use when an actionable entry has been addressed." },
  { value: "archived", label: "Archived", tone: "muted", help: "Archived entries are hidden by default from the timeline." }
] as const;

const emptyMeasurement = (): EntryMeasurement => ({ name: "", value: 0, unit: "" });

const toLocalDateTimeValue = (value?: string | null): string => {
  const parsed = value ? new Date(value) : new Date();

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const offsetMinutes = parsed.getTimezoneOffset();
  return new Date(parsed.getTime() - offsetMinutes * 60_000).toISOString().slice(0, 16);
};

const toIsoDateTime = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const formatDateTime = (value: string): string => new Date(value).toLocaleString(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

const truncate = (value: string, maxLength: number): string => (
  value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
);

const normalizeFlags = (flags: EntryFlag[]): EntryFlag[] => {
  const ordered = Array.from(new Set(flags));
  if (!ordered.includes("actionable")) {
    return ordered.filter((flag) => flag !== "resolved");
  }

  return ordered;
};

const buildEntryDraft = (entry?: Entry): EntryDraft => ({
  title: entry?.title ?? "",
  body: entry?.body ?? "",
  entryDate: toLocalDateTimeValue(entry?.entryDate),
  entryType: entry?.entryType ?? "note",
  flags: normalizeFlags(entry?.flags ?? []),
  tags: entry?.tags ?? [],
  attachmentUrl: entry?.attachmentUrl ?? "",
  attachmentName: entry?.attachmentName ?? "",
  measurements: entry?.measurements.length ? entry.measurements : []
});

const getEntryTitle = (entry: Entry): string => entry.title?.trim() || truncate(entry.body, 88);

const getAuthorLabel = (entry: Entry): string => entry.createdBy.displayName?.trim() || "Household member";

const getFlagToneClass = (flag: EntryFlag): string => {
  switch (flag) {
    case "important":
      return "entry-flag--accent";
    case "warning":
      return "entry-flag--warning";
    case "tip":
      return "entry-flag--success";
    case "actionable":
      return "entry-flag--danger";
    case "resolved":
      return "entry-flag--success";
    case "pinned":
      return "entry-flag--info";
    case "archived":
      return "entry-flag--muted";
    default:
      return "entry-flag--muted";
  }
};

function EntryGlyph({ kind }: { kind: EntryType | EntryFlag }): JSX.Element {
  const sharedProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "entry-glyph"
  };

  switch (kind) {
    case "observation":
      return <svg {...sharedProps}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "measurement":
      return <svg {...sharedProps}><path d="M7 3h10" /><path d="M12 3v18" /><path d="M9 8h3" /><path d="M9 12h3" /><path d="M9 16h3" /></svg>;
    case "lesson":
    case "tip":
      return <svg {...sharedProps}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8 14a6 6 0 1 1 8 0c-.7.6-1.2 1.5-1.4 2.4H9.4C9.2 15.5 8.7 14.6 8 14Z" /></svg>;
    case "decision":
      return <svg {...sharedProps}><path d="M7 7h10" /><path d="M7 12h10" /><path d="M7 17h6" /><path d="M18 17l2 2 3-4" /></svg>;
    case "issue":
    case "warning":
      return <svg {...sharedProps}><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v4" /><circle cx="12" cy="17" r=".7" fill="currentColor" /></svg>;
    case "milestone":
      return <svg {...sharedProps}><path d="M12 3v18" /><path d="M12 4c4 0 6 1.5 6 4s-2 4-6 4" /><path d="M12 12c-4 0-6 1.5-6 4s2 4 6 4" /></svg>;
    case "reference":
      return <svg {...sharedProps}><path d="M7 4h8l2 2v14H7Z" /><path d="M15 4v4h4" /><path d="M10 11h4" /><path d="M10 15h4" /></svg>;
    case "comparison":
      return <svg {...sharedProps}><path d="M8 5H5v14h3" /><path d="M16 5h3v14h-3" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>;
    case "important":
      return <svg {...sharedProps}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9L12 3Z" /></svg>;
    case "pinned":
      return <svg {...sharedProps}><path d="m8 3 8 8" /><path d="M13 4 20 11 15 16l-7-7Z" /><path d="M11 13 5 19" /><path d="M10 20 4 14" /></svg>;
    case "actionable":
      return <svg {...sharedProps}><circle cx="12" cy="12" r="7" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>;
    case "resolved":
      return <svg {...sharedProps}><path d="M20 6 9 17l-5-5" /></svg>;
    case "archived":
      return <svg {...sharedProps}><path d="M4 6h16" /><path d="M6 6v13h12V6" /><path d="M9 10h6" /></svg>;
    case "note":
    default:
      return <svg {...sharedProps}><path d="M7 4h10l2 2v14H7Z" /><path d="M15 4v4h4" /><path d="M9 11h6" /><path d="M9 15h6" /></svg>;
  }
}

function FlagPill({ flag }: { flag: EntryFlag }): JSX.Element {
  const meta = flagOptions.find((option) => option.value === flag);

  return (
    <span className={`entry-flag ${getFlagToneClass(flag)}`} title={meta?.help ?? meta?.label ?? flag}>
      <EntryGlyph kind={flag} />
      <span>{meta?.label ?? flag}</span>
    </span>
  );
}

function EntryTypeBadge({ entryType }: { entryType: EntryType }): JSX.Element {
  const option = entryTypeOptions.find((candidate) => candidate.value === entryType);

  return (
    <span className={`entry-type-badge entry-type-badge--${option?.tone ?? "neutral"}`}>
      <EntryGlyph kind={entryType} />
      <span>{option?.label ?? entryType}</span>
    </span>
  );
}

function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }): JSX.Element {
  return (
    <div className="entry-modal" role="dialog" aria-modal="true" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}>
      <div className="entry-modal__panel">
        <div className="entry-modal__header">
          <h2>{title}</h2>
          <button type="button" className="button button--ghost" onClick={onClose} aria-label="Close entry editor">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EntryMeasurementSparkline({ series }: { series: TrendSeries }): JSX.Element {
  const width = 180;
  const height = 44;
  const padding = 4;
  const values = series.points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = series.points.length > 1 ? (width - padding * 2) / (series.points.length - 1) : 0;
  const path = series.points.map((point, index) => {
    const x = padding + step * index;
    const y = height - padding - ((point.value - min) / range) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  const latest = series.points[series.points.length - 1];
  const previous = series.points[series.points.length - 2];
  const trendDirection = previous
    ? latest.value > previous.value
      ? "up"
      : latest.value < previous.value
        ? "down"
        : "flat"
    : "flat";

  return (
    <div className="entry-trend-card">
      <div className="entry-trend-card__header">
        <strong>{series.label}</strong>
        <span className={`entry-trend-card__delta entry-trend-card__delta--${trendDirection}`}>
          {latest.value} {series.unit}
        </span>
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="entry-trend-card__sparkline" aria-hidden="true">
        <path d={path} />
      </svg>
    </div>
  );
}

export function EntryEditor({
  householdId,
  entityType,
  entityId,
  relatedEntries = [],
  initialEntry,
  onSaved,
  onCancel,
  submitLabel,
  chrome = "inline"
}: EntryEditorProps): JSX.Element {
  const [draft, setDraft] = useState<EntryDraft>(() => buildEntryDraft(initialEntry));
  const [tagInput, setTagInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [measurementsOpen, setMeasurementsOpen] = useState(() => (
    (initialEntry?.entryType ?? "note") === "measurement" || (initialEntry?.measurements.length ?? 0) > 0
  ));
  const tagListId = useId();
  const measurementNameListId = useId();
  const measurementUnitListId = useId();

  useEffect(() => {
    setDraft(buildEntryDraft(initialEntry));
    setMeasurementsOpen((initialEntry?.entryType ?? "note") === "measurement" || (initialEntry?.measurements.length ?? 0) > 0);
    setTagInput("");
    setError(null);
  }, [initialEntry]);

  useEffect(() => {
    if (draft.entryType === "measurement") {
      setMeasurementsOpen(true);
    }
  }, [draft.entryType]);

  const tagSuggestions = useMemo(() => Array.from(new Set(
    relatedEntries.flatMap((entry) => entry.tags).map((tag) => tag.trim()).filter(Boolean)
  )).sort((left, right) => left.localeCompare(right)), [relatedEntries]);

  const measurementNames = useMemo(() => Array.from(new Set(
    relatedEntries.flatMap((entry) => entry.measurements.map((measurement) => measurement.name.trim())).filter(Boolean)
  )).sort((left, right) => left.localeCompare(right)), [relatedEntries]);

  const measurementUnits = useMemo(() => Array.from(new Set(
    relatedEntries.flatMap((entry) => entry.measurements.map((measurement) => measurement.unit.trim())).filter(Boolean)
  )).sort((left, right) => left.localeCompare(right)), [relatedEntries]);

  const visibleFlags = useMemo(() => (
    flagOptions.filter((option) => option.value !== "resolved" || draft.flags.includes("actionable"))
  ), [draft.flags]);

  const addTag = (rawValue: string): void => {
    const normalized = rawValue.trim().replace(/^,+|,+$/g, "");

    if (!normalized || draft.tags.includes(normalized) || draft.tags.length >= 20) {
      setTagInput("");
      return;
    }

    setDraft((current) => ({ ...current, tags: [...current.tags, normalized] }));
    setTagInput("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (pending || !draft.body.trim()) {
      return;
    }

    setPending(true);
    setError(null);

    const measurements = draft.measurements
      .map((measurement) => ({
        name: measurement.name.trim(),
        value: Number(measurement.value),
        unit: measurement.unit.trim()
      }))
      .filter((measurement) => measurement.name && measurement.unit && Number.isFinite(measurement.value));

    try {
      const input = {
        ...(draft.title.trim() ? { title: draft.title.trim() } : { title: null }),
        body: draft.body.trim(),
        entryDate: toIsoDateTime(draft.entryDate),
        entryType: draft.entryType,
        measurements,
        tags: draft.tags,
        ...(draft.attachmentUrl.trim() ? { attachmentUrl: draft.attachmentUrl.trim() } : { attachmentUrl: null }),
        ...(draft.attachmentName.trim() ? { attachmentName: draft.attachmentName.trim() } : { attachmentName: null }),
        flags: normalizeFlags(draft.flags)
      } satisfies Omit<CreateEntryInput, "entityType" | "entityId">;

      let saved: Entry;

      if (initialEntry) {
        const updateInput: UpdateEntryInput = input;
        saved = await updateEntry(householdId, initialEntry.id, updateInput);
        onSaved?.(saved, "update");
      } else {
        saved = await createEntry(householdId, { ...input, entityType, entityId });
        setDraft(buildEntryDraft(undefined));
        setMeasurementsOpen(draft.entryType === "measurement");
        onSaved?.(saved, "create");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save entry.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className={`entry-editor entry-editor--${chrome}`} onSubmit={handleSubmit}>
      <div className="entry-editor__grid">
        <label className="field field--full">
          <span>Title</span>
          <input
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder="Optional headline for the entry"
            disabled={pending}
          />
        </label>

        <label className="field field--full">
          <span>Body</span>
          <textarea
            value={draft.body}
            onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
            rows={10}
            placeholder="Capture the full note, observation, decision, or issue here."
            disabled={pending}
            required
          />
        </label>

        <label className="field">
          <span>Entry Date</span>
          <input
            type="datetime-local"
            value={draft.entryDate}
            onChange={(event) => setDraft((current) => ({ ...current, entryDate: event.target.value }))}
            disabled={pending}
            required
          />
        </label>

        <div className="field field--full">
          <span>Entry Type</span>
          <div className="entry-editor__segmented" role="group" aria-label="Entry type">
            {entryTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`entry-editor__segment${draft.entryType === option.value ? " entry-editor__segment--active" : ""}`}
                onClick={() => setDraft((current) => ({ ...current, entryType: option.value }))}
                disabled={pending}
              >
                <EntryGlyph kind={option.value} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field field--full">
          <span>Flags</span>
          <div className="entry-editor__flag-grid" role="group" aria-label="Entry flags">
            {visibleFlags.map((option) => {
              const active = draft.flags.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`entry-editor__flag-toggle entry-editor__flag-toggle--${option.tone}${active ? " entry-editor__flag-toggle--active" : ""}`}
                  onClick={() => setDraft((current) => ({
                    ...current,
                    flags: normalizeFlags(
                      current.flags.includes(option.value)
                        ? current.flags.filter((flag) => flag !== option.value)
                        : [...current.flags, option.value]
                    )
                  }))}
                  disabled={pending}
                  title={option.help}
                >
                  <EntryGlyph kind={option.value} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="field field--full">
          <span>Tags</span>
          <div className="entry-editor__tag-input-shell">
            <div className="entry-editor__tag-list">
              {draft.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="entry-editor__tag-chip"
                  onClick={() => setDraft((current) => ({ ...current, tags: current.tags.filter((value) => value !== tag) }))}
                  title="Remove tag"
                >
                  <span>{tag}</span>
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              <input
                list={tagListId}
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addTag(tagInput);
                  }

                  if (event.key === "Backspace" && !tagInput && draft.tags.length > 0) {
                    setDraft((current) => ({ ...current, tags: current.tags.slice(0, -1) }));
                  }
                }}
                onBlur={() => {
                  if (tagInput.trim()) {
                    addTag(tagInput);
                  }
                }}
                placeholder="Type a tag and press Enter"
                disabled={pending}
              />
              <datalist id={tagListId}>
                {tagSuggestions.map((tag) => <option key={tag} value={tag} />)}
              </datalist>
            </div>
          </div>
        </div>

        <section className={`entry-editor__measurements${measurementsOpen ? " entry-editor__measurements--open" : ""} field--full`}>
          <div className="entry-editor__section-header">
            <div>
              <strong>Measurements</strong>
              <p>Use this for tracked values, readings, or comparisons over time.</p>
            </div>
            <button type="button" className="button button--ghost button--sm" onClick={() => setMeasurementsOpen((current) => !current)}>
              {measurementsOpen ? "Collapse" : "Expand"}
            </button>
          </div>

          {measurementsOpen ? (
            <div className="entry-editor__measurements-body">
              {draft.measurements.length === 0 ? (
                <p className="panel__empty">No measurements yet.</p>
              ) : null}
              {draft.measurements.map((measurement, index) => (
                <div key={`measurement-${index}`} className="entry-editor__measurement-row">
                  <input
                    list={measurementNameListId}
                    value={measurement.name}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      measurements: current.measurements.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item)
                    }))}
                    placeholder="Measurement name"
                    disabled={pending}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={Number.isFinite(measurement.value) ? measurement.value : ""}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      measurements: current.measurements.map((item, itemIndex) => itemIndex === index ? { ...item, value: Number(event.target.value) } : item)
                    }))}
                    placeholder="Value"
                    disabled={pending}
                  />
                  <input
                    list={measurementUnitListId}
                    value={measurement.unit}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      measurements: current.measurements.map((item, itemIndex) => itemIndex === index ? { ...item, unit: event.target.value } : item)
                    }))}
                    placeholder="Unit"
                    disabled={pending}
                  />
                  <button
                    type="button"
                    className="button button--ghost button--sm"
                    onClick={() => setDraft((current) => ({
                      ...current,
                      measurements: current.measurements.filter((_, itemIndex) => itemIndex !== index)
                    }))}
                    disabled={pending}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="button button--secondary button--sm"
                onClick={() => setDraft((current) => ({ ...current, measurements: [...current.measurements, emptyMeasurement()] }))}
                disabled={pending}
              >
                + Add measurement
              </button>

              <datalist id={measurementNameListId}>
                {measurementNames.map((value) => <option key={value} value={value} />)}
              </datalist>
              <datalist id={measurementUnitListId}>
                {measurementUnits.map((value) => <option key={value} value={value} />)}
              </datalist>
            </div>
          ) : null}
        </section>

        <label className="field field--full">
          <span>Attachment URL</span>
          <input
            type="url"
            value={draft.attachmentUrl}
            onChange={(event) => setDraft((current) => ({ ...current, attachmentUrl: event.target.value }))}
            placeholder="Paste a document or image URL"
            disabled={pending}
          />
        </label>

        <label className="field field--full">
          <span>Attachment Label</span>
          <input
            value={draft.attachmentName}
            onChange={(event) => setDraft((current) => ({ ...current, attachmentName: event.target.value }))}
            placeholder="Optional file name or short label"
            disabled={pending}
          />
        </label>
      </div>

      {error ? <p className="workbench-error">{error}</p> : null}

      <div className="entry-editor__actions">
        {onCancel ? (
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="button button--primary" disabled={pending || !draft.body.trim()}>
          {pending ? "Saving…" : submitLabel ?? (initialEntry ? "Save Entry" : "Create Entry")}
        </button>
      </div>
    </form>
  );
}

export function EntryTimeline({
  householdId,
  entityType,
  entityId,
  title = "Entries",
  emptyMessage = "No entries recorded yet.",
  quickAddLabel = "New Entry",
  initialComposerOpen = false,
  entryHrefBuilder
}: EntryTimelineProps): JSX.Element {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(initialComposerOpen);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<EntryType[]>([]);
  const [selectedFlags, setSelectedFlags] = useState<EntryFlag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hasMeasurementsOnly, setHasMeasurementsOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const deferredSearchText = useDeferredValue(searchText);

  useEffect(() => {
    let cancelled = false;

    const loadEntries = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const response = await getEntries(householdId, {
          entityType,
          entityId,
          includeArchived: true,
          limit: 100
        });

        if (!cancelled) {
          setEntries(response.items);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load entries.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadEntries();

    return () => {
      cancelled = true;
    };
  }, [entityId, entityType, householdId]);

  const availableTags = useMemo(() => Array.from(new Set(entries.flatMap((entry) => entry.tags))).sort((left, right) => left.localeCompare(right)), [entries]);

  const trendSeries = useMemo<TrendSeries[]>(() => {
    const grouped = new Map<string, TrendSeries>();

    for (const entry of entries) {
      for (const measurement of entry.measurements) {
        const key = `${measurement.name}::${measurement.unit}`;
        const existing = grouped.get(key) ?? {
          key,
          label: measurement.name,
          unit: measurement.unit,
          points: []
        };

        existing.points.push({ date: entry.entryDate, value: measurement.value });
        grouped.set(key, existing);
      }
    }

    return Array.from(grouped.values())
      .map((series) => ({
        ...series,
        points: [...series.points].sort((left, right) => left.date.localeCompare(right.date))
      }))
      .filter((series) => series.points.length >= 2)
      .sort((left, right) => right.points.length - left.points.length)
      .slice(0, 4);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const startBoundary = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endBoundary = endDate ? new Date(`${endDate}T23:59:59`).getTime() : null;
    const query = deferredSearchText.trim().toLowerCase();

    return [...entries]
      .filter((entry) => includeArchived || !entry.flags.includes("archived"))
      .filter((entry) => selectedTypes.length === 0 || selectedTypes.includes(entry.entryType))
      .filter((entry) => selectedFlags.length === 0 || selectedFlags.every((flag) => entry.flags.includes(flag)))
      .filter((entry) => selectedTags.length === 0 || selectedTags.every((tag) => entry.tags.includes(tag)))
      .filter((entry) => !hasMeasurementsOnly || entry.measurements.length > 0)
      .filter((entry) => {
        const timestamp = new Date(entry.entryDate).getTime();
        if (startBoundary !== null && timestamp < startBoundary) {
          return false;
        }
        if (endBoundary !== null && timestamp > endBoundary) {
          return false;
        }
        return true;
      })
      .filter((entry) => {
        if (!query) {
          return true;
        }

        return [
          entry.title,
          entry.body,
          getAuthorLabel(entry),
          entry.tags.join(" "),
          entry.measurements.map((measurement) => `${measurement.name} ${measurement.value} ${measurement.unit}`).join(" ")
        ].join(" ").toLowerCase().includes(query);
      })
      .sort((left, right) => {
        const leftPinned = left.flags.includes("pinned") ? 1 : 0;
        const rightPinned = right.flags.includes("pinned") ? 1 : 0;

        if (leftPinned !== rightPinned) {
          return rightPinned - leftPinned;
        }

        return right.entryDate.localeCompare(left.entryDate);
      });
  }, [deferredSearchText, endDate, entries, hasMeasurementsOnly, includeArchived, selectedFlags, selectedTags, selectedTypes, startDate]);

  const toggleFlagFilter = (flag: EntryFlag): void => {
    setSelectedFlags((current) => current.includes(flag) ? current.filter((value) => value !== flag) : [...current, flag]);
  };

  const toggleTypeFilter = (entryType: EntryType): void => {
    setSelectedTypes((current) => current.includes(entryType) ? current.filter((value) => value !== entryType) : [...current, entryType]);
  };

  const toggleTagFilter = (tag: string): void => {
    setSelectedTags((current) => current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]);
  };

  const handleSaved = (saved: Entry, mode: "create" | "update"): void => {
    setEntries((current) => mode === "create"
      ? [saved, ...current]
      : current.map((entry) => entry.id === saved.id ? saved : entry));
    setComposerOpen(false);
    setEditingEntryId(null);
    setExpandedEntryId(saved.id);
  };

  const handleDelete = async (entryId: string): Promise<void> => {
    try {
      await deleteEntry(householdId, entryId);
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
      setExpandedEntryId((current) => current === entryId ? null : current);
      setEditingEntryId((current) => current === entryId ? null : current);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete entry.");
    }
  };

  const handleToggleEntryFlag = async (entry: Entry, flag: EntryFlag): Promise<void> => {
    const nextFlags = normalizeFlags(entry.flags.includes(flag)
      ? entry.flags.filter((value) => value !== flag)
      : [...entry.flags, flag]);

    try {
      const updated = await updateEntry(householdId, entry.id, { flags: nextFlags });
      setEntries((current) => current.map((item) => item.id === entry.id ? updated : item));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update entry flag.");
    }
  };

  const visibleEditingEntry = entries.find((entry) => entry.id === editingEntryId) ?? null;

  return (
    <section className="panel entry-timeline-panel">
      <div className="panel__header">
        <div>
          <h2>{title}</h2>
          <div className="data-table__secondary">Structured notes, observations, decisions, measurements, and references.</div>
        </div>
        <div className="panel__header-actions">
          <button type="button" className="button button--primary button--sm" onClick={() => setComposerOpen(true)}>
            + {quickAddLabel}
          </button>
        </div>
      </div>

      <div className="panel__body--padded entry-timeline-panel__body">
        {trendSeries.length > 0 ? (
          <section className="entry-trends">
            {trendSeries.map((series) => <EntryMeasurementSparkline key={series.key} series={series} />)}
          </section>
        ) : null}

        <section className="entry-filters">
          <div className="entry-filters__row">
            <label className="field field--full">
              <span>Search</span>
              <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search titles, body, tags, measurements, or author" />
            </label>
            <label className="field">
              <span>Start Date</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="field">
              <span>End Date</span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </div>

          <div className="entry-filters__row entry-filters__row--chips">
            <div className="entry-filter-group">
              <span>Types</span>
              <div className="entry-filter-group__chips">
                {entryTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`entry-filter-chip${selectedTypes.includes(option.value) ? " entry-filter-chip--active" : ""}`}
                    onClick={() => toggleTypeFilter(option.value)}
                  >
                    <EntryGlyph kind={option.value} />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="entry-filter-group">
              <span>Flags</span>
              <div className="entry-filter-group__chips">
                {flagOptions.filter((option) => option.value !== "resolved").map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`entry-filter-chip entry-filter-chip--${option.tone}${selectedFlags.includes(option.value) ? " entry-filter-chip--active" : ""}`}
                    onClick={() => toggleFlagFilter(option.value)}
                    title={option.help}
                  >
                    <EntryGlyph kind={option.value} />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {availableTags.length > 0 ? (
              <div className="entry-filter-group">
                <span>Tags</span>
                <div className="entry-filter-group__chips">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`entry-filter-chip${selectedTags.includes(tag) ? " entry-filter-chip--active" : ""}`}
                      onClick={() => toggleTagFilter(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="entry-filters__row entry-filters__row--toggles">
            <label className="entry-filters__toggle">
              <input type="checkbox" checked={hasMeasurementsOnly} onChange={(event) => setHasMeasurementsOnly(event.target.checked)} />
              <span>Has measurements</span>
            </label>
            <label className="entry-filters__toggle">
              <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
              <span>Include archived</span>
            </label>
            <button
              type="button"
              className="button button--ghost button--sm"
              onClick={() => {
                setSelectedTypes([]);
                setSelectedFlags([]);
                setSelectedTags([]);
                setSearchText("");
                setStartDate("");
                setEndDate("");
                setHasMeasurementsOnly(false);
                setIncludeArchived(false);
              }}
            >
              Clear Filters
            </button>
          </div>
        </section>

        {error ? <p className="workbench-error">{error}</p> : null}
        {loading ? <p className="panel__empty">Loading entries…</p> : null}
        {!loading && filteredEntries.length === 0 ? <p className="panel__empty">{emptyMessage}</p> : null}

        <div className="entry-timeline">
          {filteredEntries.map((entry) => {
            const isExpanded = expandedEntryId === entry.id;
            const isEditing = editingEntryId === entry.id;

            return (
              <article
                key={entry.id}
                id={`entry-${entry.id}`}
                className={[
                  "entry-card",
                  entry.flags.includes("important") ? "entry-card--important" : "",
                  entry.flags.includes("warning") ? "entry-card--warning" : "",
                  entry.flags.includes("tip") ? "entry-card--tip" : ""
                ].filter(Boolean).join(" ")}
              >
                <button
                  type="button"
                  className="entry-card__summary"
                  onClick={() => setExpandedEntryId((current) => current === entry.id ? null : entry.id)}
                >
                  <div className="entry-card__summary-main">
                    <div className="entry-card__summary-topline">
                      <EntryTypeBadge entryType={entry.entryType} />
                      <strong>{getEntryTitle(entry)}</strong>
                      {entry.flags.includes("pinned") ? <FlagPill flag="pinned" /> : null}
                    </div>
                    <div className="entry-card__summary-meta">
                      <span>{formatDateTime(entry.entryDate)}</span>
                      <span>•</span>
                      <span>{getAuthorLabel(entry)}</span>
                      {entry.measurements.length > 0 ? (
                        <>
                          <span>•</span>
                          <span>{entry.measurements.length} measurement{entry.measurements.length === 1 ? "" : "s"}</span>
                        </>
                      ) : null}
                    </div>
                    <div className="entry-card__summary-flags">
                      {entry.flags.filter((flag) => flag !== "pinned").map((flag) => <FlagPill key={flag} flag={flag} />)}
                      {entry.tags.map((tag) => <span key={tag} className="entry-card__tag">{tag}</span>)}
                    </div>
                  </div>
                  <span className="entry-card__summary-toggle">{isExpanded ? "Hide" : "Show"}</span>
                </button>

                {isExpanded ? (
                  <div className="entry-card__details">
                    {isEditing ? (
                      <EntryEditor
                        householdId={householdId}
                        entityType={entityType}
                        entityId={entityId}
                        initialEntry={visibleEditingEntry?.id === entry.id ? visibleEditingEntry : entry}
                        relatedEntries={entries.filter((item) => item.id !== entry.id)}
                        onSaved={handleSaved}
                        onCancel={() => setEditingEntryId(null)}
                      />
                    ) : (
                      <>
                        <div className="entry-card__body">
                          <p>{entry.body}</p>
                          {entry.attachmentUrl ? (
                            <a href={entry.attachmentUrl} target="_blank" rel="noreferrer" className="text-link">
                              {entry.attachmentName?.trim() || "Open attachment"}
                            </a>
                          ) : null}
                        </div>

                        {entry.measurements.length > 0 ? (
                          <table className="data-table entry-card__measurement-table">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Value</th>
                                <th>Unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.measurements.map((measurement, index) => (
                                <tr key={`${entry.id}-measurement-${index}`}>
                                  <td>{measurement.name}</td>
                                  <td>{measurement.value}</td>
                                  <td>{measurement.unit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : null}

                        <div className="entry-card__actions">
                          <button type="button" className="button button--secondary button--sm" onClick={() => setEditingEntryId(entry.id)}>
                            Edit
                          </button>
                          <button type="button" className="button button--ghost button--sm" onClick={() => { void handleDelete(entry.id); }}>
                            Delete
                          </button>
                          {flagOptions.filter((option) => option.value !== "resolved" || entry.flags.includes("actionable")).map((option) => (
                            <button
                              key={`${entry.id}-${option.value}`}
                              type="button"
                              className={`entry-card__action-chip${entry.flags.includes(option.value) ? " entry-card__action-chip--active" : ""}`}
                              onClick={() => { void handleToggleEntryFlag(entry, option.value); }}
                              title={option.help}
                            >
                              <EntryGlyph kind={option.value} />
                              <span>{option.label}</span>
                            </button>
                          ))}
                          {entryHrefBuilder ? (
                            <Link href={entryHrefBuilder(entry)} className="button button--ghost button--sm">Open Context</Link>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>

      {composerOpen ? (
        <ModalShell title="Create Entry" onClose={() => setComposerOpen(false)}>
          <EntryEditor
            householdId={householdId}
            entityType={entityType}
            entityId={entityId}
            relatedEntries={entries}
            onSaved={handleSaved}
            onCancel={() => setComposerOpen(false)}
            submitLabel="Create Entry"
            chrome="modal"
          />
        </ModalShell>
      ) : null}
    </section>
  );
}

export function EntryTipsSurface({
  householdId,
  queries,
  title = "Tips & Warnings from past sessions",
  entryHrefBuilder,
  defaultOpen = true
}: EntryTipsSurfaceProps): JSX.Element {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(defaultOpen);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadEntries = async (): Promise<void> => {
      setLoading(true);

      try {
        const responses = await Promise.all(queries.map((query) => getSurfacedEntries(householdId, query)));
        const deduped = Array.from(new Map(responses.flat().map((entry) => [entry.id, entry])).values())
          .sort((left, right) => {
            const leftWarning = left.flags.includes("warning") ? 1 : 0;
            const rightWarning = right.flags.includes("warning") ? 1 : 0;
            if (leftWarning !== rightWarning) {
              return rightWarning - leftWarning;
            }

            return right.entryDate.localeCompare(left.entryDate);
          });

        if (!cancelled) {
          setEntries(deduped);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (queries.length > 0) {
      void loadEntries();
    } else {
      setLoading(false);
      setEntries([]);
    }

    return () => {
      cancelled = true;
    };
  }, [householdId, queries]);

  if (dismissed || (!loading && entries.length === 0)) {
    return <></>;
  }

  return (
    <section className="entry-surface panel">
      <div className="panel__header">
        <div>
          <h2>{title}</h2>
          <div className="data-table__secondary">{loading ? "Loading surfaced context…" : `${entries.length} surfaced item${entries.length === 1 ? "" : "s"}`}</div>
        </div>
        <div className="panel__header-actions">
          <button type="button" className="button button--ghost button--sm" onClick={() => setOpen((current) => !current)}>
            {open ? "Collapse" : "Expand"}
          </button>
          <button type="button" className="button button--ghost button--sm" onClick={() => setDismissed(true)}>
            Dismiss
          </button>
        </div>
      </div>

      {open ? (
        <div className="panel__body--padded entry-surface__body">
          {entries.map((entry) => {
            const content = (
              <>
                <div className="entry-surface__item-topline">
                  <EntryTypeBadge entryType={entry.entryType} />
                  {entry.flags.filter((flag) => flag === "tip" || flag === "warning").map((flag) => <FlagPill key={`${entry.id}-${flag}`} flag={flag} />)}
                </div>
                <strong>{getEntryTitle(entry)}</strong>
                <p>{truncate(entry.body, 180)}</p>
                <div className="entry-surface__meta">From {entry.resolvedEntity.label} • {formatDateTime(entry.entryDate)}</div>
              </>
            );

            return entryHrefBuilder ? (
              <Link key={entry.id} href={entryHrefBuilder(entry)} className="entry-surface__item">
                {content}
              </Link>
            ) : (
              <article key={entry.id} className="entry-surface__item">
                {content}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function EntryActionableList({
  householdId,
  title = "Action Items",
  compact = false,
  entryHrefBuilder
}: EntryActionableListProps): JSX.Element {
  const [groups, setGroups] = useState<ActionableEntryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadEntries = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const response = await getActionableEntries(householdId);
        if (!cancelled) {
          setGroups(response);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load actionable entries.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadEntries();

    return () => {
      cancelled = true;
    };
  }, [householdId]);

  const groupedByEntity = useMemo(() => {
    const map = new Map<string, { label: string; entityType: EntryEntityType; entityId: string; items: Entry[] }>();

    for (const group of groups) {
      for (const entry of group.items) {
        const key = `${entry.resolvedEntity.entityType}:${entry.resolvedEntity.entityId}`;
        const existing = map.get(key) ?? {
          label: entry.resolvedEntity.label,
          entityType: entry.resolvedEntity.entityType,
          entityId: entry.resolvedEntity.entityId,
          items: []
        };

        existing.items.push(entry);
        map.set(key, existing);
      }
    }

    return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [groups]);

  const markResolved = async (entry: Entry): Promise<void> => {
    try {
      const updated = await updateEntry(householdId, entry.id, {
        flags: normalizeFlags([...entry.flags, "resolved"])
      });

      setGroups((current) => current.map((group) => ({
        ...group,
        items: group.items
          .map((item) => item.id === entry.id ? updated : item)
          .filter((item) => !item.flags.includes("resolved"))
      })).filter((group) => group.items.length > 0));
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Failed to resolve action item.");
    }
  };

  return (
    <section className="panel entry-actionable-panel">
      <div className="panel__header">
        <div>
          <h2>{title}</h2>
          <div className="data-table__secondary">Entries flagged as actionable across hobbies, projects, and assets.</div>
        </div>
      </div>

      <div className="panel__body--padded entry-actionable-panel__body">
        {error ? <p className="workbench-error">{error}</p> : null}
        {loading ? <p className="panel__empty">Loading action items…</p> : null}
        {!loading && groupedByEntity.length === 0 ? <p className="panel__empty">No unresolved actionable entries.</p> : null}

        {groupedByEntity.map((group) => (
          <section key={`${group.entityType}-${group.entityId}`} className="entry-actionable-group">
            <div className="entry-actionable-group__header">
              <strong>{group.label}</strong>
              <span className="pill">{group.items.length}</span>
            </div>

            <div className="entry-actionable-group__items">
              {group.items.map((entry) => (
                <article key={entry.id} className={`entry-actionable-item${compact ? " entry-actionable-item--compact" : ""}`}>
                  <div className="entry-actionable-item__main">
                    <div className="entry-actionable-item__topline">
                      <EntryTypeBadge entryType={entry.entryType} />
                      {entry.flags.includes("warning") ? <FlagPill flag="warning" /> : null}
                    </div>
                    <strong>{getEntryTitle(entry)}</strong>
                    <p>{truncate(entry.body, compact ? 120 : 180)}</p>
                    <div className="entry-actionable-item__meta">
                      <span>{entry.resolvedEntity.label}</span>
                      <span>•</span>
                      <span>{formatDateTime(entry.entryDate)}</span>
                    </div>
                  </div>
                  <div className="entry-actionable-item__actions">
                    {entryHrefBuilder ? <Link href={entryHrefBuilder(entry)} className="button button--ghost button--sm">Open</Link> : null}
                    <button type="button" className="button button--primary button--sm" onClick={() => { void markResolved(entry); }}>
                      Mark Resolved
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}