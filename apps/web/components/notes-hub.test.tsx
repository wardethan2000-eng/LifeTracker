import type { JSX } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const entityWorkspaceMock = vi.fn((props: unknown): JSX.Element => <div data-testid="entity-notes-workspace">Notebook workspace {String(Boolean(props))}</div>);
const canvasListMock = vi.fn((props: unknown): JSX.Element => <div data-testid="canvas-list">Canvas list {String(Boolean(props))}</div>);

vi.mock("./entity-notes-workspace", () => ({
  EntityNotesWorkspace: (props: unknown) => entityWorkspaceMock(props),
}));

vi.mock("./canvas-list", () => ({
  CanvasList: (props: unknown) => canvasListMock(props),
}));

import { NotesHub } from "./notes-hub";

describe("NotesHub", () => {
  it("uses the shared entity notes workspace for the notebook tab", () => {
    render(
      <NotesHub
        householdId="clhousehold000000000001"
        templates={[]}
        canvases={[]}
      />,
    );

    expect(screen.getByTestId("entity-notes-workspace")).toBeInTheDocument();
    expect(entityWorkspaceMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      householdId: "clhousehold000000000001",
      entityType: "notebook",
      entityId: "clhousehold000000000001",
      backToHref: "/notes?householdId=clhousehold000000000001",
      notebookOptions: expect.objectContaining({
        manageTemplatesHref: "/notes/templates?householdId=clhousehold000000000001",
      }),
    }));
    expect(entityWorkspaceMock.mock.calls[0]?.[0]).not.toHaveProperty("title");
    expect(entityWorkspaceMock.mock.calls[0]?.[0]).not.toHaveProperty("subtitle");
  });

  it("switches to the canvases surface without unmounting the notebook shell permanently", () => {
    render(
      <NotesHub
        householdId="clhousehold000000000001"
        templates={[]}
        canvases={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Canvases" }));
    expect(screen.getByTestId("canvas-list")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Notes" }));
    expect(screen.getByTestId("entity-notes-workspace")).toBeInTheDocument();
  });
});
