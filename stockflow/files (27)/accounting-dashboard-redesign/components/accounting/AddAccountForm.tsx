"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClassifiedAccount } from "@/actions/accounting-tree";
import { CLASSIFICATION_OPTIONS } from "@/lib/accounting/classifications";

type Parent = { id: string; code: string; name: string };

export function AddAccountForm({
  statementGroup,
  groupLabel,
  parents,
  onDone,
}: {
  statementGroup: string;
  groupLabel: string;
  parents: Parent[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [classification, setClassification] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [vat, setVat] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setErr(null);
    if (!name.trim()) return setErr("Account name is required");
    if (!classification) return setErr("Pick a classification");
    start(async () => {
      const res = await createClassifiedAccount({
        name,
        currency,
        classification: classification as any,
        statementGroup: statementGroup as any,
        parentId: parentId || null,
        description: description || null,
        note: note || null,
        vatApplicable: vat,
      });
      if (res.success) {
        onDone();
        router.refresh();
      } else {
        setErr(res.error || "Could not create account");
      }
    });
  }

  return (
    <div style={{ padding: "14px 16px", background: "var(--surface2)", borderTop: "1px solid var(--border2)" }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
        Add account under <span style={{ color: "var(--accent)" }}>{groupLabel}</span>
      </div>

      {err && (
        <div style={{ padding: "8px 12px", borderRadius: 6, marginBottom: 12, fontSize: 13, background: "rgba(239,68,68,0.1)", color: "#fca5a5" }}>
          {err}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <Field label="Account name *">
          <input style={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diesel — Fuel" />
        </Field>
        <Field label="Currency">
          <input style={inp} value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </Field>
        <Field label="Classification *">
          <select style={inp} value={classification} onChange={(e) => setClassification(e.target.value)}>
            <option value="">Select…</option>
            {CLASSIFICATION_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Sub-account of (optional)">
          <select style={inp} value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— none (main account) —</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Description (optional)">
          <input style={inp} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <input style={inp} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", marginTop: 12 }}>
        <input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} />
        VAT applies to this account (16%)
      </label>

      <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone} disabled={pending}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save account"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, display: "block" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: "8px 10px", background: "var(--surface)",
  border: "1px solid var(--border2)", borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 14,
};
