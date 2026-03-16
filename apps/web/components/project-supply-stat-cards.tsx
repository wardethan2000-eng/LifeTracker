import type { JSX } from "react";
import { getProjectPhaseDetails } from "../lib/api";
import { formatCurrency } from "../lib/formatters";

type ProjectSupplyStatCardsProps = {
  householdId: string;
  projectId: string;
};

export async function ProjectSupplyStatCards({ householdId, projectId }: ProjectSupplyStatCardsProps): Promise<JSX.Element> {
  const phaseDetails = await getProjectPhaseDetails(householdId, projectId);
  const allSupplies = phaseDetails.flatMap((phase) => phase.supplies);
  const totalSupplyLines = allSupplies.length;
  const totalSuppliesProcured = allSupplies.filter((supply) => supply.isProcured).length;
  const estimatedProcurementCost = allSupplies.reduce((sum, supply) => sum + ((supply.estimatedUnitCost ?? 0) * supply.quantityNeeded), 0);
  const inventoryLinkedSupplyCount = allSupplies.filter((supply) => supply.inventoryItemId !== null).length;
  const inventoryCoveredSupplyCount = allSupplies.filter((supply) => (
    supply.inventoryItemId !== null
    && (supply.inventoryItem?.quantityOnHand ?? 0) >= Math.max(supply.quantityNeeded - supply.quantityOnHand, 0)
  )).length;
  const remainingProcurementCost = allSupplies.reduce((sum, supply) => {
    const quantityRemaining = Math.max(supply.quantityNeeded - supply.quantityOnHand, 0);
    return sum + ((supply.estimatedUnitCost ?? 0) * quantityRemaining);
  }, 0);

  return (
    <>
      <div className="stat-card">
        <span className="stat-card__label">Supplies</span>
        <strong className="stat-card__value">{totalSuppliesProcured} / {totalSupplyLines}</strong>
        <span className="stat-card__sub">{formatCurrency(remainingProcurementCost, "$0.00")} estimated remaining procurement cost</span>
      </div>
      <div className="stat-card stat-card--danger">
        <span className="stat-card__label">Supplies Overview</span>
        <strong className="stat-card__value">{formatCurrency(estimatedProcurementCost, "$0.00")}</strong>
        <span className="stat-card__sub">{inventoryLinkedSupplyCount} linked to inventory, {inventoryCoveredSupplyCount} fully coverable from stock</span>
      </div>
    </>
  );
}