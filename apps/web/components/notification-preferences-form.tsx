"use client";
import { useTransition, useState } from "react";
import type { NotificationPreferences, UpdateNotificationPreferencesInput } from "@lifekeeper/types";
import { updateNotificationPreferencesAction } from "../app/actions";

interface NotificationPreferencesFormProps {
  initialPreferences: NotificationPreferences;
}

const CHANNELS: Array<{ value: "push" | "email" | "digest"; label: string }> = [
  { value: "push", label: "In-app push" },
  { value: "email", label: "Email" },
  { value: "digest", label: "Daily digest" }
];

export function NotificationPreferencesForm({ initialPreferences }: NotificationPreferencesFormProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [channelError, setChannelError] = useState(false);

  const [pauseAll, setPauseAll] = useState(initialPreferences.pauseAll);
  const [enabledChannels, setEnabledChannels] = useState<Array<"push" | "email" | "digest">>(
    initialPreferences.enabledChannels
  );
  const [preferDigest, setPreferDigest] = useState(initialPreferences.preferDigest);

  const toggleChannel = (channel: "push" | "email" | "digest") => {
    setChannelError(false);
    setEnabledChannels((prev) => {
      if (prev.includes(channel)) {
        return prev.filter((c) => c !== channel);
      }
      return [...prev, channel];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (enabledChannels.length === 0) {
      setChannelError(true);
      return;
    }

    const input: UpdateNotificationPreferencesInput = {
      pauseAll,
      enabledChannels,
      preferDigest
    };

    startTransition(async () => {
      await updateNotificationPreferencesAction(input);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const controlsDisabled = pauseAll || isPending;

  return (
    <form onSubmit={handleSubmit} aria-label="Notification preferences">
      <div className="workbench-grid">
        <div className="workbench-section">
          <label className="workbench-section__toggle">
            <input
              type="checkbox"
              checked={pauseAll}
              onChange={(e) => setPauseAll(e.target.checked)}
              disabled={isPending}
              aria-label="Pause all notifications"
            />
            <span>
              <strong>Pause all notifications</strong>
              <span className="data-table__secondary">Temporarily silence all alerts (e.g. while on vacation).</span>
            </span>
          </label>
        </div>

        <div className="workbench-section">
          <fieldset disabled={controlsDisabled} aria-label="Enabled channels">
            <legend>
              <strong>Enabled channels</strong>
            </legend>
            {CHANNELS.map(({ value, label }) => (
              <label key={value} className="workbench-section__toggle">
                <input
                  type="checkbox"
                  checked={enabledChannels.includes(value)}
                  onChange={() => toggleChannel(value)}
                  aria-label={label}
                />
                <span>{label}</span>
              </label>
            ))}
            {channelError && (
              <p className="data-table__secondary" role="alert" style={{ color: "var(--danger, red)" }}>
                At least one channel must be enabled.
              </p>
            )}
          </fieldset>
        </div>

        <div className="workbench-section">
          <label className="workbench-section__toggle">
            <input
              type="checkbox"
              checked={preferDigest}
              onChange={(e) => setPreferDigest(e.target.checked)}
              disabled={controlsDisabled || !enabledChannels.includes("digest")}
              aria-label="Prefer digest"
            />
            <span>
              <strong>Prefer digest</strong>
              <span className="data-table__secondary">Batch notifications into a daily digest when possible.</span>
            </span>
          </label>
        </div>
      </div>

      <div className="workbench-bar">
        <button type="submit" className="btn btn--primary" disabled={isPending}>
          {isPending ? "Saving…" : "Save preferences"}
        </button>
        {saved && (
          <span className="data-table__secondary" role="status">
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
