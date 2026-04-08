"use client";

import type { JSX } from "react";
import { useCallback, useState, useTransition } from "react";
import type { IdeaLinkItem } from "@aegis/types";
import { addIdeaLinkAction, removeIdeaLinkAction } from "../app/actions";
import { Card } from "./card";

type IdeaLinksCardProps = {
  householdId: string;
  ideaId: string;
  links: IdeaLinkItem[];
};

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function IdeaLinksCard({ householdId, ideaId, links }: IdeaLinksCardProps): JSX.Element {
  const [localLinks, setLocalLinks] = useState<IdeaLinkItem[]>(links);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAdd = useCallback(() => {
    const trimmedUrl = url.trim();
    const trimmedLabel = label.trim();
    if (!trimmedUrl || !trimmedLabel) return;

    const optimisticLink: IdeaLinkItem = {
      id: crypto.randomUUID(),
      url: trimmedUrl,
      label: trimmedLabel,
      createdAt: new Date().toISOString(),
    };
    setLocalLinks((prev) => [...prev, optimisticLink]);
    setUrl("");
    setLabel("");

    startTransition(async () => {
      await addIdeaLinkAction(householdId, ideaId, trimmedUrl, trimmedLabel);
    });
  }, [url, label, householdId, ideaId]);

  const handleRemove = useCallback(
    (linkId: string) => {
      setLocalLinks((prev) => prev.filter((l) => l.id !== linkId));
      startTransition(async () => {
        await removeIdeaLinkAction(householdId, ideaId, linkId);
      });
    },
    [householdId, ideaId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  return (
    <Card title={`Links (${localLinks.length})`}>
      {localLinks.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
          No links saved. Bookmark useful references as you find them.
        </p>
      ) : (
        <div>
          {localLinks.map((link) => (
            <div key={link.id} className="idea-link-entry">
              <span style={{ flexShrink: 0 }}>🔗</span>
              <div className="idea-link-entry__info">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="idea-link-entry__label"
                >
                  {link.label}
                </a>
                <div className="idea-link-entry__url">{getHostname(link.url)}</div>
              </div>
              <button
                type="button"
                className="button button--ghost button--xs"
                onClick={() => handleRemove(link.id)}
                aria-label={`Remove link ${link.label}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="idea-link-form">
        <input
          type="url"
          className="input input--sm"
          placeholder="URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          style={{ flex: 1 }}
        />
        <input
          type="text"
          className="input input--sm"
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="button button--primary button--sm"
          onClick={handleAdd}
          disabled={isPending || !url.trim() || !label.trim()}
        >
          Add
        </button>
      </div>
    </Card>
  );
}
