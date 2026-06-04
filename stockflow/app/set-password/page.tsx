"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setInvitedUserPassword } from "@/actions/password";

export default function SetPasswordPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await setInvitedUserPassword(formData);
      if ("error" in result) {
        setError(result.error ?? "Could not set password.");
        return;
      }

      router.replace("/login?passwordSet=1");
      router.refresh();
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-main)",
          padding: "40px",
          width: "100%",
          maxWidth: "420px",
        }}
      >
        <h1 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "8px" }}>
          Create your password
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "24px" }}>
          Set a password to finish accepting your StockFlow invitation.
        </p>

        {error && (
          <div
            style={{
              background: "rgba(224, 85, 85, 0.15)",
              color: "var(--red)",
              padding: "12px",
              borderRadius: "var(--radius-small)",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: "16px" }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              className="form-input"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={isPending}
            />
          </div>

          <div className="form-group" style={{ marginBottom: "24px" }}>
            <label className="form-label">Confirm password</label>
            <input
              type="password"
              name="confirmation"
              className="form-input"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={isPending}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Set password"}
          </button>
        </form>
      </div>
    </div>
  );
}
