import type { JSX } from "react";
import { getHouseholdInventory, getProjectPhaseDetails } from "../lib/api";
import { ProjectSuppliesWorkspace } from "./project-supplies-workspace";

type ProjectSuppliesWorkspaceSectionProps = {
  householdId: string;
  projectId: string;
};

export async function ProjectSuppliesWorkspaceSection({ householdId, projectId }: ProjectSuppliesWorkspaceSectionProps): Promise<JSX.Element> {
  const [phaseDetails, inventory] = await Promise.all([
    getProjectPhaseDetails(householdId, projectId),
    getHouseholdInventory(householdId, { limit: 100 })
  ]);

  const inventoryLookup = new Map(inventory.items.map((item) => [item.id, item]));
  const phases = phaseDetails.map((phase) => ({ id: phase.id, name: phase.name }));
  const supplies = phaseDetails.flatMap((phase) => phase.supplies.map((supply) => ({
    ...supply,
    phaseName: phase.name,
    openPhaseHref: `/projects/${projectId}/phases?householdId=${householdId}&phaseId=${phase.id}`,
    ...(supply.inventoryItemId && inventoryLookup.has(supply.inventoryItemId)
      ? { linkedInventoryItem: inventoryLookup.get(supply.inventoryItemId)! }
      : {})
  })));

  return (
    <ProjectSuppliesWorkspace
      householdId={householdId}
      projectId={projectId}
      phases={phases}
      supplies={supplies}
      inventoryItems={inventory.items}
    />
  );
}
