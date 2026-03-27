import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getEntries: vi.fn(),
  createEntry: vi.fn(),
  deleteEntry: vi.fn(),
  updateEntry: vi.fn(),
  getSurfacedEntries: vi.fn(),
  getActionableEntries: vi.fn(),
}));

vi.mock("../lib/api", () => apiMocks);

vi.mock("../lib/formatted-date", () => ({
  useFormattedDate: () => ({
    formatDate: (d: string) => d,
    formatDateTime: (d: string) => d,
  }),
}));

vi.mock("../lib/timezone-context", () => ({
  useTimezone: () => ({ timezone: "America/New_York" }),
}));

vi.mock("../lib/date-input-utils", () => ({
  toHouseholdDateTimeInputValue: (d: string | undefined) => d ?? "",
  fromHouseholdDateTimeInput: (d: string) => d || new Date().toISOString(),
}));

vi.mock("@lifekeeper/utils", () => ({
  isLegacyImportedEntrySourceType: () => false,
}));

import { EntryTimeline } from "./entry-system";

const baseProps = {
  householdId: "h1",
  entityType: "project" as const,
  entityId: "p1",
  title: "Project Log",
  quickAddLabel: "Note",
};

describe("EntryTimeline", () => {
  it("renders the inline quick-add composer on load", async () => {
    apiMocks.getEntries.mockResolvedValueOnce({ items: [], total: 0 });

    render(<EntryTimeline {...baseProps} />);

    expect(screen.getByPlaceholderText(/quick note/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^log$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /more options/i })).toBeInTheDocument();
  });

  it("does not show filters by default", async () => {
    apiMocks.getEntries.mockResolvedValueOnce({ items: [], total: 0 });

    render(<EntryTimeline {...baseProps} />);

    expect(screen.queryByText("Start Date")).not.toBeInTheDocument();
    expect(screen.queryByText("End Date")).not.toBeInTheDocument();
  });

  it("shows filters when the filter toggle is clicked", async () => {
    apiMocks.getEntries.mockResolvedValueOnce({ items: [], total: 0 });
    const user = userEvent.setup();

    render(<EntryTimeline {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /filters/i }));

    expect(screen.getByText("Start Date")).toBeInTheDocument();
    expect(screen.getByText("End Date")).toBeInTheDocument();
    expect(screen.getByText("Clear Filters")).toBeInTheDocument();
  });

  it("does not render a modal when creating an entry", async () => {
    apiMocks.getEntries.mockResolvedValueOnce({ items: [], total: 0 });

    const { container } = render(<EntryTimeline {...baseProps} />);

    expect(container.querySelector(".entry-modal")).toBeNull();
  });

  it("submits a quick entry inline", async () => {
    apiMocks.getEntries.mockResolvedValueOnce({ items: [], total: 0 });
    apiMocks.createEntry.mockResolvedValueOnce({
      id: "e1",
      title: null,
      body: "Test note",
      entryDate: "2026-03-26T00:00:00.000Z",
      entryType: "note",
      flags: [],
      tags: [],
      measurements: [],
      attachmentUrl: null,
      attachmentName: null,
      bodyFormat: null,
      sourceType: null,
      createdBy: { displayName: "Dev" },
      resolvedEntity: { entityType: "project", entityId: "p1", label: "Test", parentEntityId: null },
      createdAt: "2026-03-26T00:00:00.000Z",
      updatedAt: "2026-03-26T00:00:00.000Z",
    });

    const user = userEvent.setup();

    render(<EntryTimeline {...baseProps} />);

    const textarea = screen.getByPlaceholderText(/quick note/i);
    await user.type(textarea, "Test note");
    await user.click(screen.getByRole("button", { name: /^log$/i }));

    await waitFor(() => {
      expect(apiMocks.createEntry).toHaveBeenCalledWith("h1", expect.objectContaining({
        body: "Test note",
        entryType: "note",
        entityType: "project",
        entityId: "p1",
      }));
    });
  });

  it("opens the full inline editor when 'More options' is clicked", async () => {
    apiMocks.getEntries.mockResolvedValueOnce({ items: [], total: 0 });
    const user = userEvent.setup();

    render(<EntryTimeline {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /more options/i }));

    expect(screen.getByText("Entry Type")).toBeInTheDocument();
    expect(screen.getByText("Flags")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create entry/i })).toBeInTheDocument();
  });

  it("renders existing entries in the timeline", async () => {
    apiMocks.getEntries.mockResolvedValueOnce({
      items: [
        {
          id: "e1",
          title: "Fixed the leak",
          body: "Replaced the washer in the kitchen faucet.",
          entryDate: "2026-03-25T12:00:00.000Z",
          entryType: "note",
          flags: [],
          tags: [],
          measurements: [],
          attachmentUrl: null,
          attachmentName: null,
          bodyFormat: null,
          sourceType: null,
          createdBy: { displayName: "Dev" },
          resolvedEntity: { entityType: "project", entityId: "p1", label: "Test", parentEntityId: null },
          createdAt: "2026-03-25T12:00:00.000Z",
          updatedAt: "2026-03-25T12:00:00.000Z",
        },
      ],
      total: 1,
    });

    render(<EntryTimeline {...baseProps} />);

    expect(await screen.findByText("Fixed the leak")).toBeInTheDocument();
  });
});
