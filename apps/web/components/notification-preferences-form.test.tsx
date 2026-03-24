import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const actionMocks = vi.hoisted(() => ({
  updateNotificationPreferencesAction: vi.fn()
}));

vi.mock("../app/actions", () => ({
  updateNotificationPreferencesAction: actionMocks.updateNotificationPreferencesAction
}));

import { NotificationPreferencesForm } from "./notification-preferences-form";
import type { NotificationPreferences } from "@lifekeeper/types";

const defaultPreferences: NotificationPreferences = {
  pauseAll: false,
  enabledChannels: ["push", "email"],
  preferDigest: false
};

describe("NotificationPreferencesForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actionMocks.updateNotificationPreferencesAction.mockResolvedValue(undefined);
  });

  it("renders correct initial state", () => {
    render(<NotificationPreferencesForm initialPreferences={defaultPreferences} />);

    expect(screen.getByRole("checkbox", { name: /pause all/i })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /in-app push/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^email$/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /daily digest/i })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /prefer digest/i })).not.toBeChecked();
  });

  it("disables channel controls and prefer-digest when pause all is enabled", async () => {
    const user = userEvent.setup();

    render(
      <NotificationPreferencesForm
        initialPreferences={{ ...defaultPreferences, pauseAll: true }}
      />
    );

    const fieldset = screen.getByRole("group", { name: /enabled channels/i });

    expect(within(fieldset).getByRole("checkbox", { name: /in-app push/i })).toBeDisabled();
    expect(within(fieldset).getByRole("checkbox", { name: /^email$/i })).toBeDisabled();
    expect(within(fieldset).getByRole("checkbox", { name: /daily digest/i })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /prefer digest/i })).toBeDisabled();

    // Toggling pause all off re-enables controls
    await user.click(screen.getByRole("checkbox", { name: /pause all/i }));
    expect(within(fieldset).getByRole("checkbox", { name: /in-app push/i })).not.toBeDisabled();
  });

  it("shows inline validation when all channels are unchecked and prevents submit", async () => {
    const user = userEvent.setup();

    render(<NotificationPreferencesForm initialPreferences={defaultPreferences} />);

    await user.click(screen.getByRole("checkbox", { name: /in-app push/i }));
    await user.click(screen.getByRole("checkbox", { name: /^email$/i }));
    await user.click(screen.getByRole("button", { name: /save preferences/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/at least one channel must be enabled/i);
    expect(actionMocks.updateNotificationPreferencesAction).not.toHaveBeenCalled();
  });

  it("calls the action with the correct payload on valid submit", async () => {
    const user = userEvent.setup();

    render(<NotificationPreferencesForm initialPreferences={defaultPreferences} />);

    // Enable digest channel
    await user.click(screen.getByRole("checkbox", { name: /daily digest/i }));

    // Enable prefer digest
    await user.click(screen.getByRole("checkbox", { name: /prefer digest/i }));

    await user.click(screen.getByRole("button", { name: /save preferences/i }));

    expect(actionMocks.updateNotificationPreferencesAction).toHaveBeenCalledWith({
      pauseAll: false,
      enabledChannels: expect.arrayContaining(["push", "email", "digest"]),
      preferDigest: true
    });
  });

  it("prefer digest is disabled when digest channel is not selected", () => {
    render(<NotificationPreferencesForm initialPreferences={defaultPreferences} />);

    // defaultPreferences has no "digest" in enabledChannels
    expect(screen.getByRole("checkbox", { name: /prefer digest/i })).toBeDisabled();
  });
});
