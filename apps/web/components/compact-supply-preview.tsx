type SupplyEntry = {
  id: string;
  name: string;
  quantityNeeded: number;
  quantityOnHand: number;
  isProcured: boolean;
  isStaged: boolean;
  estimatedUnitCost: number | null | undefined;
};

type Props = {
  supplies: SupplyEntry[];
  estimatedCost: number;
  remainingCost: number;
};

function formatCurrencySimple(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function CompactSupplyPreview({ supplies, estimatedCost, remainingCost }: Props) {
  if (supplies.length === 0) {
    return (
      <div className="compact-preview">
        <p className="compact-preview__empty">No supplies added yet</p>
      </div>
    );
  }

  const procuredCount = supplies.filter((s) => s.isProcured).length;
  const stagedCount = supplies.filter((s) => s.isStaged).length;
  const procurementPct = Math.round((procuredCount / supplies.length) * 100);

  const unprocured = supplies.filter((s) => !s.isProcured).slice(0, 4);
  const overflow = Math.max(supplies.length - 4, 0);

  return (
    <div className="compact-preview">
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
        <span className="compact-preview__pill">{procuredCount}/{supplies.length} procured</span>
        <span className="compact-preview__pill">{stagedCount} staged</span>
        {estimatedCost > 0 ? (
          <span className="compact-preview__pill">{formatCurrencySimple(estimatedCost)} estimated</span>
        ) : null}
        {remainingCost > 0 ? (
          <span className={`compact-preview__pill compact-preview__pill--muted`}>
            {formatCurrencySimple(remainingCost)} remaining
          </span>
        ) : null}
        <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>{procurementPct}% done</span>
      </div>
      {unprocured.length > 0 ? (
        <table className="compact-preview__mini-table" aria-label="Supplies preview">
          <tbody>
            {unprocured.map((supply) => (
              <tr key={supply.id}>
                <td>{supply.name}</td>
                <td style={{ textAlign: "right", color: "var(--ink-muted)", fontSize: "0.82rem" }}>
                  {supply.quantityOnHand}/{supply.quantityNeeded}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {overflow > 0 ? (
        <p className="compact-preview__overflow">+{overflow} more — expand to manage</p>
      ) : null}
    </div>
  );
}
