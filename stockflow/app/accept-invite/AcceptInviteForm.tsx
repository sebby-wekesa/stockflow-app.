"use client";

import { useActionState } from "react";
import { acceptInvitation } from "@/actions/invitations";

export function AcceptInviteForm({
  tokenHash,
  type,
}: {
  tokenHash: string;
  type: string;
}) {
  const [state, formAction, isPending] = useActionState(acceptInvitation, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />

      {state?.error && (
        <div
          style={{
            background: "rgba(224, 85, 85, 0.15)",
            color: "var(--red)",
            padding: "12px",
            borderRadius: "var(--radius-small)",
            marginBottom: "16px",
          }}
        >
          {state.error}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: "100%" }}
        disabled={isPending || !tokenHash || type !== "invite"}
      >
        {isPending ? "Accepting..." : "Accept invitation"}
      </button>
    </form>
  );
}
