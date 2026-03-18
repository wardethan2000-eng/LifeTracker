import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScheduleForm } from "./schedule-form";

const formAction = "/test-action" as unknown as (formData: FormData) => void | Promise<void>;

describe("ScheduleForm", () => {
  it("disables usage-based creation when the asset has no metrics", async () => {
    const user = userEvent.setup();

    render(
      <ScheduleForm
        assetId="asset-1"
        metrics={[]}
        action={formAction}
      />
    );

    await user.click(screen.getByRole("button", { name: "+ New Maintenance Schedule" }));
    await user.click(screen.getByRole("radio", { name: /usage/i }));

    expect(screen.getByText(/requires a usage metric/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create schedule/i })).toBeDisabled();
  });

  it("reveals compound trigger controls and keeps notification state in sync", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <ScheduleForm
        assetId="asset-1"
        metrics={[{ id: "metric-1", name: "Odometer", unit: "mi" }]}
        action={formAction}
      />
    );

    await user.click(screen.getByRole("button", { name: "+ New Maintenance Schedule" }));
    await user.click(screen.getByRole("radio", { name: /compound/i }));

    expect(screen.getByRole("combobox", { name: /tracked metric/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /trigger logic/i })).toBeInTheDocument();

    const digestToggle = screen.getByRole("checkbox", { name: /weekly digest/i });
    const digestHidden = container.querySelector('input[name="digest"]') as HTMLInputElement | null;

    expect(digestHidden).not.toBeNull();
    if (!digestHidden) {
      throw new Error("Expected digest hidden input.");
    }
    expect(digestHidden.name).toBe("digest");
    await user.click(digestToggle);
    expect(digestHidden.value).toBe("on");
  });

  it("reveals one-time scheduling fields and collapses back on cancel", async () => {
    const user = userEvent.setup();

    render(
      <ScheduleForm
        assetId="asset-1"
        metrics={[{ id: "metric-1", name: "Odometer", unit: "mi" }]}
        action={formAction}
      />
    );

    await user.click(screen.getByRole("button", { name: "+ New Maintenance Schedule" }));
    await user.click(screen.getByRole("radio", { name: /one-time/i }));

    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.getByRole("button", { name: "+ New Maintenance Schedule" })).toBeInTheDocument();
  });
});