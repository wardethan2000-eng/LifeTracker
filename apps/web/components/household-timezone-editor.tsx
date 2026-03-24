"use client";

import type { JSX } from "react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { updateHousehold } from "../lib/api";

type HouseholdTimezoneEditorProps = {
  householdId: string;
  currentTimezone: string;
};

function getUtcOffset(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    return offset;
  } catch {
    return "";
  }
}

function buildTimezoneOptions(): { value: string; label: string }[] {
  const zones: string[] = Intl.supportedValuesOf("timeZone");
  return zones.map((tz) => {
    const offset = getUtcOffset(tz);
    return { value: tz, label: `${tz.replace(/_/g, " ")} (${offset})` };
  });
}

export function HouseholdTimezoneEditor({
  householdId,
  currentTimezone,
}: HouseholdTimezoneEditorProps): JSX.Element {
  const [selected, setSelected] = useState(currentTimezone);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const options = useMemo(() => buildTimezoneOptions(), []);

  const handleSave = useCallback(() => {
    if (selected === currentTimezone) return;
    setErrorMessage(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateHousehold(householdId, { timezone: selected });
        setSaved(true);
        // Reload so the TimezoneProvider picks up the new value
        window.location.reload();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to save timezone.");
      }
    });
  }, [householdId, selected, currentTimezone]);

  return (
    <div className="timezone-editor">
      <div className="timezone-editor__field">
        <label htmlFor="household-timezone">Household timezone</label>
        <select
          id="household-timezone"
          value={selected}
          onChange={(event) => {
            setSelected(event.target.value);
            setSaved(false);
          }}
          disabled={isPending}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="timezone-editor__hint">
          All dates and times across the app are displayed in this timezone.
        </p>
      </div>

      {errorMessage && (
        <p className="timezone-editor__error">{errorMessage}</p>
      )}
      {saved && (
        <p className="timezone-editor__success">Timezone saved.</p>
      )}

      <div className="timezone-editor__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleSave}
          disabled={isPending || selected === currentTimezone}
        >
          {isPending ? "Saving…" : "Save timezone"}
        </button>
      </div>
    </div>
  );
}
