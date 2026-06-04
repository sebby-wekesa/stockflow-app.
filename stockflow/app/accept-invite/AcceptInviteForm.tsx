"use client";

import { type FormEvent, useState, useTransition } from "react";
import { acceptInvitation } from "@/actions/invitations";

export function AcceptInviteForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      try {
        const result = await acceptInvitation(formData);
        if (result?.error) {
          setError(result.error);
        }
      } catch (submissionError) {
        setError(
          submissionError instanceof Error
            ? submissionError.message
            : "Could not accept invitation. Please try again."
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
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

      <div className="form-group" style={{ marginBottom: "16px" }}>
        <label className="form-label">Invitation email</label>
        <input
          type="email"
          name="email"
          className="form-input"
          autoComplete="email"
          disabled={isPending}
        />
      </div>

      <div className="form-group" style={{ marginBottom: "24px" }}>
        <label className="form-label">Invitation code</label>
        <input
          type="text"
          name="token"
          className="form-input"
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="Enter the code from the email"
          disabled={isPending}
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: "100%" }}
        disabled={isPending}
      >
        {isPending ? "Accepting..." : "Accept invitation"}
      </button>
    </form>
  );
}
