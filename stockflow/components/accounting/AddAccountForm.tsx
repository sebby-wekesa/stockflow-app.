"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClassifiedAccount } from "@/actions/accounting-tree";
import {
  CLASSIFICATION_OPTIONS,
  type Classification,
  type StatementGroup,
} from "@/lib/accounting/classifications";

type ParentAccount = {
  id: string;
  code: string;
  name: string;
};

export function AddAccountForm({
  statementGroup,
  groupLabel,
  parents,
  onDone,
}: {
  statementGroup: string;
  groupLabel: string;
  parents: ParentAccount[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [classification, setClassification] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [vatApplicable, setVatApplicable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Account name is required");
      return;
    }
    if (!classification) {
      setError("Pick a classification");
      return;
    }

    startTransition(async () => {
      const result = await createClassifiedAccount({
        name,
        currency,
        classification: classification as Classification,
        statementGroup: statementGroup as StatementGroup,
        parentId: parentId || null,
        description: description || null,
        note: note || null,
        vatApplicable,
      });

      if (result.success) {
        onDone();
        router.refresh();
        return;
      }
      setError(result.error || "Could not create account");
    });
  }

  return (
    <form
      onSubmit={submit}
      style={{
        padding: "14px 16px",
        background: "var(--surface2)",
        borderTop: "1px solid var(--border2)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
        Add account under{" "}
        <span style={{ color: "var(--accent)" }}>{groupLabel}</span>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            marginBottom: 12,
            fontSize: 13,
            background: "rgba(224,85,85,0.12)",
            color: "var(--red)",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <Field label="Account name *">
          <input
            style={inputStyle}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Diesel - Fuel"
          />
        </Field>
        <Field label="Currency">
          <input
            style={inputStyle}
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          />
        </Field>
        <Field label="Classification *">
          <select
            style={inputStyle}
            value={classification}
            onChange={(event) => setClassification(event.target.value)}
          >
            <option value="">Select...</option>
            {CLASSIFICATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sub-account of">
          <select
            style={inputStyle}
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">None - main account</option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.code} - {parent.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <input
            style={inputStyle}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <Field label="Note">
          <input
            style={inputStyle}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          cursor: "pointer",
          marginTop: 12,
        }}
      >
        <input
          type="checkbox"
          checked={vatApplicable}
          onChange={(event) => setVatApplicable(event.target.checked)}
        />
        VAT applies to this account
      </label>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onDone}
          disabled={pending}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? "Saving..." : "Save account"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: 4,
          display: "block",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--surface)",
  border: "1px solid var(--border2)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  fontSize: 14,
};
