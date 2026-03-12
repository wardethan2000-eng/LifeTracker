"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 40, fontFamily: "system-ui, sans-serif" }}>
      <h2>Something went wrong</h2>
      <pre style={{ whiteSpace: "pre-wrap", color: "#b91c1c", fontSize: "0.85rem", background: "#fef2f2", padding: 16, borderRadius: 8 }}>
        {error.message}
      </pre>
      {error.digest && <p style={{ color: "#6b7280", fontSize: "0.8rem" }}>Digest: {error.digest}</p>}
      <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}>
        Try again
      </button>
    </div>
  );
}
