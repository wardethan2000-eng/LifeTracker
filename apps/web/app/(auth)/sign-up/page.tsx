"use client";

import type { JSX, FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "../../../lib/auth-client";

const inputStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--surface-alt)",
  color: "inherit",
  fontSize: "0.9375rem",
  outline: "none",
};

export default function SignUpPage(): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authClient.signUp.email({ name, email, password });

      if (result.error) {
        setError(result.error.message ?? "Sign up failed.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1.25rem", textAlign: "center" }}>
        Create account
      </h2>

      {error && (
        <p
          style={{
            background: "var(--danger-bg, #fee2e2)",
            color: "var(--danger, #dc2626)",
            border: "1px solid var(--danger-border, #fca5a5)",
            borderRadius: "var(--radius)",
            padding: "0.625rem 0.875rem",
            fontSize: "0.875rem",
            marginBottom: "1rem",
          }}
        >
          {error}
        </p>
      )}

      <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            style={inputStyle}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "0.25rem",
            padding: "0.625rem",
            background: "var(--accent, #0f766e)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius)",
            fontWeight: 600,
            fontSize: "0.9375rem",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p style={{ marginTop: "1.25rem", textAlign: "center", fontSize: "0.875rem", color: "var(--text-muted)" }}>
        Already have an account?{" "}
        <Link href="/sign-in" style={{ color: "var(--accent, #0f766e)", fontWeight: 500 }}>
          Sign in
        </Link>
      </p>
    </>
  );
}
