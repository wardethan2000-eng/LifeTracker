import type { ReactNode } from "react";
import type { JSX } from "react";

export default function AuthLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "2rem",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Aegis</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
