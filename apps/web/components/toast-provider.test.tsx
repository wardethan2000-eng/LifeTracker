import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ToastProvider, useToast } from "./toast-provider";

function ToastHarness({
  onAction,
  onExpire,
}: {
  onAction: () => void;
  onExpire: () => void;
}) {
  const { pushToast } = useToast();

  return (
    <button
      type="button"
      onClick={() => {
        pushToast({
          message: "Asset archived.",
          tone: "danger",
          actionLabel: "Undo",
          duration: 5000,
          onAction,
          onExpire,
        });
      }}
    >
      Show Toast
    </button>
  );
}

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("finalizes the deferred action when the toast is dismissed", async () => {
    const onAction = vi.fn();
    const onExpire = vi.fn();

    render(
      <ToastProvider>
        <ToastHarness onAction={onAction} onExpire={onExpire} />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Show Toast" }));
    fireEvent.click(screen.getByRole("button", { name: /dismiss notification/i }));

    expect(onAction).not.toHaveBeenCalled();
    expect(onExpire).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("cancels finalization when the user clicks undo", async () => {
    const onAction = vi.fn();
    const onExpire = vi.fn();

    render(
      <ToastProvider>
        <ToastHarness onAction={onAction} onExpire={onExpire} />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Show Toast" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onExpire).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(onExpire).not.toHaveBeenCalled();
    expect(screen.queryByText("Asset archived.")).not.toBeInTheDocument();
  });
});