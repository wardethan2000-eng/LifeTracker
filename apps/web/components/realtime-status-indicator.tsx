"use client";

import type { JSX } from "react";
import { useTranslations } from "next-intl";
import { useRealtimeConnectionState } from "./realtime-sync-provider";

type RealtimeStatusIndicatorProps = {
  householdId?: string | null;
};

export function RealtimeStatusIndicator({ householdId: _householdId = null }: RealtimeStatusIndicatorProps): JSX.Element {
  const t = useTranslations("common.toolbar.realtime");
  const connectionState = useRealtimeConnectionState();
  const isConnected = connectionState === "connected";
  const label = isConnected ? t("connected") : connectionState === "paused" ? t("paused") : t("disconnected");

  return (
    <div className="toolbar-status" aria-live="polite">
      <span className={`toolbar-status__dot toolbar-status__dot--${isConnected ? "connected" : connectionState}`} aria-hidden="true" />
      <span className="toolbar-status__label">{label}</span>
    </div>
  );
}