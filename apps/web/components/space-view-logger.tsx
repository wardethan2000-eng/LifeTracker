"use client";

import { useEffect } from "react";
import { logSpaceDirectNavigation } from "../lib/api";

type SpaceViewLoggerProps = {
  householdId: string;
  spaceId: string;
};

export function SpaceViewLogger({ householdId, spaceId }: SpaceViewLoggerProps): null {
  useEffect(() => {
    void logSpaceDirectNavigation(householdId, spaceId).catch(() => undefined);
  }, [householdId, spaceId]);

  return null;
}
