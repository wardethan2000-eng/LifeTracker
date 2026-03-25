import type { JSX } from "react";
import Link from "next/link";
import { ApiError, getHouseholdInventoryTrash, getMe } from "../../../../lib/api";
import { formatDate } from "../../../../lib/formatters";

export default async function InventoryTrashPage(): Promise<JSX.Element> {
  const user = await getMe();
  const householdId = user.households[0]?.id;

  if (!householdId) {
    return <p className="panel__empty">No household found.</p>;
  }

  let trashedItems: Awaited<ReturnType<typeof getHouseholdInventoryTrash>> = [];

  try {
    trashedItems = await getHouseholdInventoryTrash(householdId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      trashedItems = [];
    } else {
      throw error;
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Inventory Trash</h1>
          <p className="data-table__secondary">Soft-deleted inventory items. These can be restored or permanently removed.</p>
        </div>
        <Link href="/inventory" className="button button--ghost button--sm">← Back to Inventory</Link>
      </div>

      <section className="panel">
        <div className="panel__body">
          {trashedItems.length === 0 ? (
            <p className="panel__empty">No trashed inventory items.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Last Stock</th>
                  <th>Deleted</th>
                </tr>
              </thead>
              <tbody>
                {trashedItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="data-table__primary">{item.name}</div>
                      <div className="data-table__secondary">
                        {[item.partNumber, item.manufacturer].filter(Boolean).join(" • ") || "—"}
                      </div>
                    </td>
                    <td>{item.category}</td>
                    <td>{item.quantityOnHand} {item.unit}</td>
                    <td>{formatDate(item.updatedAt, "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
