import type { JSX } from "react";
import { getHouseholdSpacesTree } from "../lib/api";
import { SpacesSectionClient } from "./spaces-section-client";

type SpacesSectionProps = {
  householdId: string;
};

export async function SpacesSection({ householdId }: SpacesSectionProps): Promise<JSX.Element> {
  const spaces = await getHouseholdSpacesTree(householdId);
  return <SpacesSectionClient householdId={householdId} spaces={spaces} />;
}