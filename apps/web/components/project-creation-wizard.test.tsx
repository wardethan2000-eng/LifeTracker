import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectCreationWizard } from "./project-creation-wizard";

describe("ProjectCreationWizard", () => {
  const householdId = "ckprojecthousehold000000000001";

  it("shows guided starter details when blueprint mode is selected", () => {
    render(
      <ProjectCreationWizard
        createAction={vi.fn(async () => undefined)}
        createFromTemplateAction={vi.fn(async () => undefined)}
        householdId={householdId}
        projectTemplates={[]}
        cancelHref="/projects"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Use a guided starter/i }));

    const blueprintSelect = screen.getByLabelText("Starter blueprint");
    expect(blueprintSelect).toBeInTheDocument();

    fireEvent.change(blueprintSelect, {
      target: { value: (blueprintSelect as HTMLSelectElement).options[1]?.value ?? "" },
    });

    expect(screen.getByText("5 phases")).toBeInTheDocument();
    expect(screen.getByText(/budget buckets/i)).toBeInTheDocument();
  });

  it("switches saved template flow into the template-specific naming step", async () => {
    render(
      <ProjectCreationWizard
        createAction={vi.fn(async () => undefined)}
        createFromTemplateAction={vi.fn(async () => undefined)}
        householdId={householdId}
        projectTemplates={[
          {
            id: "ckprojecttemplate000000000001",
            householdId,
            sourceProjectId: null,
            name: "Deck Build Template",
            description: "Saved structure for deck projects.",
            notes: null,
            phaseCount: 4,
            taskCount: 18,
            assetCount: 0,
            createdAt: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
        ]}
        cancelHref="/projects"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Reuse a saved template/i }));
    fireEvent.click(screen.getByRole("button", { name: /Deck Build Template/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Name the new project")).toBeInTheDocument();
    expect(screen.getByText(/refine the description, budget, and notes after the template is created/i)).toBeInTheDocument();
  });
});
