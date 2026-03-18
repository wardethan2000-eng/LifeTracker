import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nextNavigationMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  searchParams: new URLSearchParams(),
}));

const realtimeMocks = vi.hoisted(() => ({
  connectionState: "disconnected" as "idle" | "connecting" | "connected" | "reconnecting" | "paused" | "disconnected",
  options: null as null | {
    householdId: string | null;
    eventTypes?: string[];
    enabled?: boolean;
    onEvent?: () => void;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: nextNavigationMocks.refresh }),
  useSearchParams: () => nextNavigationMocks.searchParams,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("./use-realtime-updates", () => ({
  useRealtimeUpdates: (options: {
    householdId: string | null;
    eventTypes?: string[];
    enabled?: boolean;
    onEvent?: () => void;
  }) => {
    realtimeMocks.options = options;
    return {
      connectionState: realtimeMocks.connectionState,
      lastEvent: null,
    };
  },
}));

import { RealtimeRefreshBoundary } from "./realtime-refresh-boundary";
import { RealtimeStatusIndicator } from "./realtime-status-indicator";

describe("Realtime UI", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T12:00:00.000Z"));
    nextNavigationMocks.refresh.mockReset();
    nextNavigationMocks.searchParams = new URLSearchParams();
    realtimeMocks.connectionState = "disconnected";
    realtimeMocks.options = null;
  });

  it("uses the active household from the query string for the status indicator", () => {
    nextNavigationMocks.searchParams = new URLSearchParams("householdId=query-household");
    realtimeMocks.connectionState = "connected";

    render(<RealtimeStatusIndicator householdId="fallback-household" />);

    expect(realtimeMocks.options).toMatchObject({
      householdId: "query-household",
      enabled: true,
    });
    expect(screen.getByText("connected")).toBeInTheDocument();
  });

  it("throttles router refreshes when realtime events arrive too quickly", () => {
    render(
      <RealtimeRefreshBoundary
        householdId="household-1"
        eventTypes={["inventory.changed"]}
      />
    );

    expect(realtimeMocks.options).toMatchObject({
      householdId: "household-1",
      enabled: true,
      eventTypes: ["inventory.changed"],
    });

    act(() => {
      realtimeMocks.options?.onEvent?.();
      realtimeMocks.options?.onEvent?.();
    });

    expect(nextNavigationMocks.refresh).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1001);
      realtimeMocks.options?.onEvent?.();
    });

    expect(nextNavigationMocks.refresh).toHaveBeenCalledTimes(2);
  });
});