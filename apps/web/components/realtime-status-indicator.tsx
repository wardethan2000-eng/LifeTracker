"use client";

import type { JSX } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRealtimeUpdates } from "./use-realtime-updates";

type RealtimeStatusIndicatorProps = {
  householdId: string | null;
};

export function RealtimeStatusIndicator({ householdId }: RealtimeStatusIndicatorProps): JSX.Element {
  const searchParams = useSearchParams();
  const t = useTranslations("common.toolbar.realtime");
  const activeHouseholdId = searchParams.get("householdId") ?? householdId;
  const { connectionState } = useRealtimeUpdates({ householdId: activeHouseholdId, enabled: Boolean(activeHouseholdId) });
  const isConnected = connectionState === "connected";
  const label = isConnected ? t("connected") : connectionState === "paused" ? t("paused") : t("disconnected");

  return (
    <div className="toolbar-status" aria-live="polite">
      <span className={`toolbar-status__dot toolbar-status__dot--${isConnected ? "connected" : connectionState}`} aria-hidden="true" />
      <span className="toolbar-status__label">{label}</span>
    </div>
  );
}