"use client";

import { useEffect, useState } from "react";
import {
  addDashboardPin,
  getDashboardPins,
  removeDashboardPin,
} from "../lib/api";
import type { CreateDashboardPinInput } from "@aegis/types";

type PinButtonProps = {
  entityType: CreateDashboardPinInput["entityType"];
  entityId: string;
};

export function PinButton({ entityType, entityId }: PinButtonProps) {
  const [pinId, setPinId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDashboardPins()
      .then((pins) => {
        if (cancelled) return;
        const match = pins.find(
          (p) => p.entityType === entityType && p.entityId === entityId
        );
        setPinId(match?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setPinId(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  const handleToggle = async () => {
    setBusy(true);
    try {
      if (pinId) {
        await removeDashboardPin(pinId);
        setPinId(null);
      } else {
        const res = await addDashboardPin({ entityType, entityId });
        setPinId(res.id);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <button
      type="button"
      className={`pin-button${pinId ? " pin-button--active" : ""}`}
      onClick={handleToggle}
      disabled={busy}
      title={pinId ? "Remove from dashboard" : "Pin to dashboard"}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={pinId ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
      {pinId ? "Pinned" : "Pin to Dashboard"}
    </button>
  );
}
