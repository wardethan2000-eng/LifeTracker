import type { JSX } from "react";
import Link from "next/link";

export default function AssetScanNotFound(): JSX.Element {
  return (
    <main className="public-report" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", display: "grid", gap: 12, maxWidth: 420 }}>
        <div className="public-report__brand">Aegis</div>
        <h1 className="public-report__title" style={{ margin: 0 }}>Asset label not recognized</h1>
        <p style={{ margin: 0, color: "var(--ink-muted)" }}>
          This QR label or asset tag does not match an accessible asset. Check that the label is current and that you are signed into the correct household.
        </p>
        <p style={{ margin: 0 }}>
          <Link href="/assets" className="text-link">Go to assets</Link>
        </p>
      </div>
    </main>
  );
}