"use client";

import type {
  InventoryTransactionQuery,
  InventoryTransactionWithItem,
  InventoryTransactionType,
} from "@lifekeeper/types";
import { Fragment, type JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createInventoryTransactionCorrection, getHouseholdInventoryTransactions } from "../lib/api";
import { formatCurrency, formatDateTime } from "../lib/formatters";

type InventoryTransactionHistoryProps = {
  householdId: string;
  inventoryItemId?: string;
  title?: string;
};

type TransactionTypeFilter = "all" | "purchase" | "consume" | "adjust" | "correction";
type ReferenceTypeFilter = "all" | "maintenance_log" | "project" | "hobby_session" | "manual" | "inventory_transaction";

const pageSize = 50;

const toStartDateIso = (value: string): string => new Date(`${value}T00:00:00`).toISOString();

const toEndDateIso = (value: string): string => new Date(`${value}T23:59:59.999`).toISOString();

const getTransactionTone = (type: InventoryTransactionType): "restock" | "consume" | "adjust" => {
  if (type === "purchase") {
    return "restock";
  }

  if (type === "consume") {
    return "consume";
  }

  return "adjust";
};

const getTransactionLabel = (type: InventoryTransactionType): string => {
  switch (type) {
    case "purchase":
      return "Restock";
    case "correction":
      return "Correction";
    case "project_supply_allocation":
      return "Project Allocation";
    case "return":
      return "Return";
    case "transfer":
      return "Transfer";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
  }
};

const formatQuantity = (value: number): string => (value > 0 ? `+${value}` : String(value));

const formatReferenceLabel = (value: string): string => value
  .replace(/_/g, " ")
  .replace(/\b\w/g, (character) => character.toUpperCase());

const getCorrectionSummary = (transaction: InventoryTransactionWithItem): string | null => {
  if (transaction.correctionOfTransaction) {
    return `Corrects ${getTransactionLabel(transaction.correctionOfTransaction.type)} ${formatQuantity(transaction.correctionOfTransaction.quantity)}`;
  }

  if (transaction.correctedByTransactions.length === 1) {
    return "Corrected by 1 linked follow-up entry";
  }

  if (transaction.correctedByTransactions.length > 1) {
    return `Corrected by ${transaction.correctedByTransactions.length} linked follow-up entries`;
  }

  return null;
};

const truncateText = (value: string | null, length = 72): string => {
  if (!value) {
    return "—";
  }

  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length - 1).trimEnd()}…`;
};

export function InventoryTransactionHistory({ householdId, inventoryItemId, title = "Transaction History" }: InventoryTransactionHistoryProps): JSX.Element {
  const router = useRouter();
  const [transactions, setTransactions] = useState<InventoryTransactionWithItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("all");
  const [referenceTypeFilter, setReferenceTypeFilter] = useState<ReferenceTypeFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [replacementQuantity, setReplacementQuantity] = useState("");
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [correctionErrorMessage, setCorrectionErrorMessage] = useState<string | null>(null);
  const [pendingCorrectionId, setPendingCorrectionId] = useState<string | null>(null);

  const queryOptions = useMemo<InventoryTransactionQuery>(() => ({
    ...(startDate ? { startDate: toStartDateIso(startDate) } : {}),
    ...(endDate ? { endDate: toEndDateIso(endDate) } : {}),
    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
    ...(referenceTypeFilter !== "all" ? { referenceType: referenceTypeFilter } : {}),
    ...(inventoryItemId ? { inventoryItemId } : {}),
    limit: pageSize,
  }), [endDate, inventoryItemId, referenceTypeFilter, startDate, typeFilter]);

  const showItemColumn = !inventoryItemId;
  const tableColumnCount = showItemColumn ? 9 : 8;

  useEffect(() => {
    let cancelled = false;

    const loadInitialPage = async (): Promise<void> => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const result = await getHouseholdInventoryTransactions(householdId, queryOptions);

        if (cancelled) {
          return;
        }

        setTransactions(result.transactions);
        setNextCursor(result.nextCursor);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setTransactions([]);
        setNextCursor(null);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load transaction history.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadInitialPage();

    return () => {
      cancelled = true;
    };
  }, [householdId, queryOptions]);

  const handleLoadMore = async (): Promise<void> => {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setErrorMessage(null);

    try {
      const result = await getHouseholdInventoryTransactions(householdId, {
        ...queryOptions,
        cursor: nextCursor,
      });

      setTransactions((current) => [...current, ...result.transactions]);
      setNextCursor(result.nextCursor);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load more transactions.");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleCorrection = (transaction: InventoryTransactionWithItem): void => {
    if (editingTransactionId === transaction.id) {
      setEditingTransactionId(null);
      setReplacementQuantity("");
      setCorrectionNotes("");
      setCorrectionErrorMessage(null);
      return;
    }

    setEditingTransactionId(transaction.id);
    setReplacementQuantity(String(transaction.quantity));
    setCorrectionNotes("");
    setCorrectionErrorMessage(null);
  };

  const handleCreateCorrection = async (transaction: InventoryTransactionWithItem): Promise<void> => {
    const parsedQuantity = Number(replacementQuantity);

    if (!Number.isFinite(parsedQuantity)) {
      setCorrectionErrorMessage("Enter a valid signed replacement quantity.");
      return;
    }

    setPendingCorrectionId(transaction.id);
    setCorrectionErrorMessage(null);
    setErrorMessage(null);

    try {
      await createInventoryTransactionCorrection(householdId, transaction.id, {
        replacementQuantity: parsedQuantity,
        ...(correctionNotes.trim() ? { notes: correctionNotes.trim() } : {})
      });

      const result = await getHouseholdInventoryTransactions(householdId, queryOptions);
      setTransactions(result.transactions);
      setNextCursor(result.nextCursor);
      setEditingTransactionId(null);
      setReplacementQuantity("");
      setCorrectionNotes("");
      router.refresh();
    } catch (error) {
      setCorrectionErrorMessage(error instanceof Error ? error.message : "Failed to create correction.");
    } finally {
      setPendingCorrectionId(null);
    }
  };

  return (
    <section className="panel inventory-transaction-history">
      <div className="panel__header">
        <div>
          <h2>{title}</h2>
          <div className="data-table__secondary">{transactions.length} shown</div>
        </div>
      </div>
      <div className="panel__body">
        <div className="inventory-transaction-history__filters form-grid">
          <label className="field">
            <span>Transaction Type</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TransactionTypeFilter)}>
              <option value="all">All</option>
              <option value="purchase">Restock</option>
              <option value="consume">Consume</option>
              <option value="adjust">Adjust</option>
              <option value="correction">Correction</option>
            </select>
          </label>
          <label className="field">
            <span>Reference Type</span>
            <select value={referenceTypeFilter} onChange={(event) => setReferenceTypeFilter(event.target.value as ReferenceTypeFilter)}>
              <option value="all">All</option>
              <option value="maintenance_log">Maintenance Log</option>
              <option value="project">Project</option>
              <option value="hobby_session">Hobby Session</option>
              <option value="manual">Manual</option>
              <option value="inventory_transaction">Inventory Transaction</option>
            </select>
          </label>
          <label className="field">
            <span>Start Date</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="field">
            <span>End Date</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>

        {loading ? (
          <p className="panel__empty">Loading transaction history…</p>
        ) : errorMessage && transactions.length === 0 ? (
          <p className="panel__empty">{errorMessage}</p>
        ) : transactions.length === 0 ? (
          <p className="panel__empty">No transactions matched the current filters.</p>
        ) : (
          <>
            {errorMessage ? <p className="panel__empty">{errorMessage}</p> : null}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {showItemColumn ? <th>Item</th> : null}
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Balance After</th>
                  <th>Reference</th>
                  <th>Cost</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => {
                  const tone = getTransactionTone(transaction.type);
                  const correctionSummary = getCorrectionSummary(transaction);

                  return (
                    <Fragment key={transaction.id}>
                      <tr key={transaction.id}>
                        <td>{formatDateTime(transaction.createdAt, "—")}</td>
                        {showItemColumn ? (
                          <td>
                            <div className="data-table__primary">{transaction.itemName}</div>
                            <div className="data-table__secondary">{transaction.itemPartNumber ?? "No part number"}</div>
                          </td>
                        ) : null}
                        <td>
                          <span className={`inventory-transaction-type inventory-transaction-type--${tone}`}>
                            <span className="inventory-transaction-type__dot" aria-hidden="true" />
                            {getTransactionLabel(transaction.type)}
                          </span>
                          {correctionSummary ? <div className="inventory-transaction-meta">{correctionSummary}</div> : null}
                        </td>
                        <td>{formatQuantity(transaction.quantity)}</td>
                        <td>{transaction.quantityAfter}</td>
                        <td>
                          {transaction.referenceType ? (
                            <>
                              <div className="data-table__primary">{formatReferenceLabel(transaction.referenceType)}</div>
                              <div className="data-table__secondary">{transaction.referenceId ?? "—"}</div>
                            </>
                          ) : "—"}
                        </td>
                        <td>{formatCurrency(transaction.unitCost, "—")}</td>
                        <td title={transaction.notes ?? undefined}>{truncateText(transaction.notes)}</td>
                        <td>
                          <button
                            type="button"
                            className="button button--ghost button--sm"
                            onClick={() => handleToggleCorrection(transaction)}
                            disabled={pendingCorrectionId !== null}
                          >
                            {editingTransactionId === transaction.id ? "Close" : "Correct"}
                          </button>
                        </td>
                      </tr>
                      {editingTransactionId === transaction.id ? (
                        <tr className="inventory-transaction-history__correction-row">
                          <td colSpan={tableColumnCount}>
                            <div className="inventory-transaction-correction">
                              <div className="inventory-transaction-correction__intro">
                                <strong>Record correction</strong>
                                <p>This adds a linked compensating transaction and preserves the original audit trail.</p>
                              </div>
                              <div className="form-grid">
                                <label className="field">
                                  <span>Replacement Quantity</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={replacementQuantity}
                                    onChange={(event) => setReplacementQuantity(event.target.value)}
                                    disabled={pendingCorrectionId !== null}
                                  />
                                  <span className="inventory-transaction-correction__hint">
                                    Use signed inventory movement. Current entry: {formatQuantity(transaction.quantity)}.
                                  </span>
                                </label>
                                <label className="field field--full">
                                  <span>Correction Notes</span>
                                  <textarea
                                    rows={3}
                                    value={correctionNotes}
                                    onChange={(event) => setCorrectionNotes(event.target.value)}
                                    placeholder="Explain why this transaction is being corrected."
                                    disabled={pendingCorrectionId !== null}
                                  />
                                </label>
                              </div>
                              {correctionErrorMessage ? <p className="workbench-error">{correctionErrorMessage}</p> : null}
                              <div className="inline-actions inline-actions--end">
                                <button
                                  type="button"
                                  className="button button--ghost button--sm"
                                  onClick={() => setReplacementQuantity("0")}
                                  disabled={pendingCorrectionId !== null}
                                >
                                  Void Effect
                                </button>
                                <button
                                  type="button"
                                  className="button button--ghost button--sm"
                                  onClick={() => handleToggleCorrection(transaction)}
                                  disabled={pendingCorrectionId !== null}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="button button--primary button--sm"
                                  onClick={() => { void handleCreateCorrection(transaction); }}
                                  disabled={pendingCorrectionId !== null}
                                >
                                  {pendingCorrectionId === transaction.id ? "Saving…" : "Create Correction"}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {nextCursor ? (
              <div className="inventory-transaction-history__footer">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}