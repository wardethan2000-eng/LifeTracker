import type { JSX } from "react";
import { Card } from "./card";
import { getProjectPhaseDetails } from "../lib/api";
import { formatCurrency } from "../lib/formatters";

type ProjectLinkedInventoryCardProps = {
  householdId: string;
  projectId: string;
};

export async function ProjectLinkedInventoryCard({ householdId, projectId }: ProjectLinkedInventoryCardProps): Promise<JSX.Element> {
  const phaseDetails = await getProjectPhaseDetails(householdId, projectId);
  const allSupplies = phaseDetails.flatMap((phase) => phase.supplies);
  const totalSupplyLines = allSupplies.length;
  const totalSuppliesProcured = allSupplies.filter((supply) => supply.isProcured).length;
  const totalSuppliesStaged = allSupplies.filter((supply) => supply.isStaged).length;
  const inventoryLinkedSupplyCount = allSupplies.filter((supply) => supply.inventoryItemId !== null).length;
  const inventoryCoveredSupplyCount = allSupplies.filter((supply) => (
    supply.inventoryItemId !== null
    && (supply.inventoryItem?.quantityOnHand ?? 0) >= Math.max(supply.quantityNeeded - supply.quantityOnHand, 0)
  )).length;
  const estimatedProcurementCost = allSupplies.reduce((sum, supply) => sum + ((supply.estimatedUnitCost ?? 0) * supply.quantityNeeded), 0);
  const remainingProcurementCost = allSupplies.reduce((sum, supply) => {
    const quantityRemaining = Math.max(supply.quantityNeeded - supply.quantityOnHand, 0);
    return sum + ((supply.estimatedUnitCost ?? 0) * quantityRemaining);
  }, 0);

  return (
    <Card title="Linked Inventory">
      <dl className="schedule-meta">
        <div><dt>Supply lines</dt><dd>{totalSupplyLines}</dd></div>
        <div><dt>Procured</dt><dd>{totalSuppliesProcured} / {totalSupplyLines}</dd></div>
        <div><dt>Staged</dt><dd>{totalSuppliesStaged} / {totalSupplyLines}</dd></div>
        <div><dt>Inventory-linked</dt><dd>{inventoryLinkedSupplyCount} lines</dd></div>
        <div><dt>Covered from stock</dt><dd>{inventoryCoveredSupplyCount} fully covered</dd></div>
        <div><dt>Est. procurement</dt><dd>{formatCurrency(estimatedProcurementCost, "$0.00")}</dd></div>
        <div><dt>Remaining cost</dt><dd>{formatCurrency(remainingProcurementCost, "$0.00")}</dd></div>
      </dl>
    </Card>
  );
}