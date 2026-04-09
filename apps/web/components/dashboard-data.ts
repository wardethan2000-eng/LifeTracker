import { cache } from "react";
import type { HouseholdDashboard } from "@aegis/types";
import { getHouseholdDashboard } from "../lib/api";

// Request-scoped cache so dashboard sections can fetch in parallel without duplicate API calls.
export const getDashboardData = cache(async (householdId: string): Promise<HouseholdDashboard> => (
  getHouseholdDashboard(householdId)
));
