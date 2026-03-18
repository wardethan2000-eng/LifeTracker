"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type JSX } from "react";

type HobbySeriesWorkbenchProps = {
  action: (formData: FormData) => Promise<void>;
  householdId: string;
  hobbyId: string;
};

export function HobbySeriesWorkbench({ action, householdId, hobbyId }: HobbySeriesWorkbenchProps): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [tags, setTags] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("householdId", householdId);
      formData.set("hobbyId", hobbyId);
      formData.set("name", name);
      formData.set("status", status);
      if (description.trim()) formData.set("description", description.trim());
      if (tags.trim()) formData.set("tags", tags.trim());
      if (coverImageUrl.trim()) formData.set("coverImageUrl", coverImageUrl.trim());
      if (notes.trim()) formData.set("notes", notes.trim());
      await action(formData);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create series.");
      setSubmitting(false);
    }
  };

  return (
    <form className="workbench-form" onSubmit={handleSubmit}>
      <section className="workbench-section">
        <div className="workbench-section__head">
          <h3>Series Setup</h3>
        </div>

        <div className="workbench-grid">
          <label className="workbench-field workbench-field--wide">
            <span className="workbench-field__label">Series Name <span className="workbench-field__required">*</span></span>
            <input
              type="text"
              className="workbench-field__input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. House Pilsner Iterations"
              required
            />
          </label>

          <label className="workbench-field">
            <span className="workbench-field__label">Status</span>
            <select className="workbench-field__input" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className="workbench-field">
            <span className="workbench-field__label">Tags</span>
            <input
              type="text"
              className="workbench-field__input"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="lager, spring, test"
            />
          </label>

          <label className="workbench-field workbench-field--wide">
            <span className="workbench-field__label">Description</span>
            <textarea
              className="workbench-field__input workbench-field__textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="What product, recipe line, or experiment does this series track?"
            />
          </label>

          <label className="workbench-field workbench-field--wide">
            <span className="workbench-field__label">Cover Image URL</span>
            <input
              type="url"
              className="workbench-field__input"
              value={coverImageUrl}
              onChange={(event) => setCoverImageUrl(event.target.value)}
              placeholder="https://example.com/series-cover.jpg"
            />
          </label>

          <label className="workbench-field workbench-field--wide">
            <span className="workbench-field__label">Notes</span>
            <textarea
              className="workbench-field__input workbench-field__textarea"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={6}
              placeholder="Capture the baseline recipe intent, what will be compared across batches, and what success looks like."
            />
          </label>
        </div>
      </section>

      {error ? <p className="workbench-error">{error}</p> : null}

      <div className="workbench-bar">
        <button type="button" className="button button--ghost" disabled={submitting} onClick={() => router.back()}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={submitting || !name.trim()}>
          {submitting ? "Creating…" : "Create Series"}
        </button>
      </div>
    </form>
  );
}