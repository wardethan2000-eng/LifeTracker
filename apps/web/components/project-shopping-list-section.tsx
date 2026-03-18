import type { JSX } from "react";
import { createProjectPurchaseRequestsAction } from "../app/actions";
import { Card } from "./card";
import { ProjectShoppingListItemActions } from "./project-shopping-list-item-actions";
import { getProjectShoppingList } from "../lib/api";
import { formatCurrency } from "../lib/formatters";

type ProjectShoppingListSectionProps = {
  householdId: string;
  projectId: string;
};

export async function ProjectShoppingListSection({ householdId, projectId }: ProjectShoppingListSectionProps): Promise<JSX.Element> {
  const shoppingList = await getProjectShoppingList(householdId, projectId);
  const requestedCount = shoppingList.items.filter((item) => item.activePurchaseRequest !== null).length;

  return (
    <Card title="Shopping List">
      {shoppingList.lineCount === 0 ? (
        <p className="panel__empty">All supplies have been procured. Nothing on the shopping list.</p>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "0 0 12px" }}>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "0.85rem", color: "var(--ink-muted)" }}>
              <span>{shoppingList.lineCount} item{shoppingList.lineCount === 1 ? "" : "s"}</span>
              <span>·</span>
              <span>{shoppingList.supplierCount} supplier{shoppingList.supplierCount === 1 ? "" : "s"}</span>
              <span>·</span>
              <span>{requestedCount} requested</span>
              <span>·</span>
              <span>~{formatCurrency(shoppingList.totalEstimatedCost, "$0.00")} estimated</span>
            </div>
            <form action={createProjectPurchaseRequestsAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="projectId" value={projectId} />
              <button type="submit" className="button button--sm">Create Draft Purchases</button>
            </form>
          </div>
          {shoppingList.groupedBySupplier.map((group) => (
            <div key={group.supplierName} style={{ marginBottom: "16px" }}>
              <div style={{ background: "var(--surface-alt)", padding: "8px 12px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong style={{ fontSize: "0.92rem" }}>{group.supplierName}</strong>
                  {group.supplierUrl ? (
                    <a href={group.supplierUrl} target="_blank" rel="noopener noreferrer" className="text-link" style={{ fontSize: "0.78rem" }}>↗ website</a>
                  ) : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>Subtotal: {formatCurrency(group.subtotal, "$0.00")}</span>
                  <form action={createProjectPurchaseRequestsAction}>
                    <input type="hidden" name="householdId" value={householdId} />
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="supplyIdsJson" value={JSON.stringify(group.items.filter((item) => item.activePurchaseRequest === null).map((item) => item.id))} />
                    <button
                      type="submit"
                      className="button button--ghost button--sm"
                      disabled={group.items.every((item) => item.activePurchaseRequest !== null)}
                    >
                      Create Draft
                    </button>
                  </form>
                </div>
              </div>
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Supply</th>
                    <th>Qty Remaining</th>
                    <th>Unit Cost</th>
                    <th>Line Cost</th>
                    <th>Request</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="data-table__primary">{item.name}</div>
                        <div className="data-table__secondary">{item.projectName} › {item.phaseName}</div>
                      </td>
                      <td style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>{item.quantityRemaining} {item.unit}</td>
                      <td style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>{item.estimatedUnitCost != null ? formatCurrency(item.estimatedUnitCost, "$0.00") : "—"}</td>
                      <td style={{ fontSize: "0.82rem" }}>{item.estimatedLineCost != null ? formatCurrency(item.estimatedLineCost, "$0.00") : "—"}</td>
                      <td style={{ fontSize: "0.82rem" }}>
                        {item.activePurchaseRequest ? (
                          <div style={{ display: "grid", gap: 4 }}>
                            <span className={`status-chip status-chip--${item.activePurchaseRequest.purchaseStatus === "ordered" ? "due" : "warning"}`}>
                              {item.activePurchaseRequest.purchaseStatus}
                            </span>
                            <span className="data-table__secondary">Line {item.activePurchaseRequest.lineStatus}</span>
                          </div>
                        ) : (
                          <span className="data-table__secondary">Not requested</span>
                        )}
                      </td>
                      <td>
                        <ProjectShoppingListItemActions householdId={householdId} item={item} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </Card>
  );
}