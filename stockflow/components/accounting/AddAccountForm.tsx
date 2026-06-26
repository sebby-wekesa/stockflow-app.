"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createClassifiedAccount,
  updateClassifiedAccount,
} from "@/actions/accounting-tree";
import {
  CLASSIFICATION_MAP,
  CLASSIFICATION_OPTIONS,
  STATEMENT_GROUPS,
  type Classification,
  type StatementGroup,
} from "@/lib/accounting/classifications";

type ParentAccount = {
  id: string;
  code: string;
  name: string;
};

type BranchOption = {
  id: string;
  name: string;
  code: string;
};

type EditableAccount = {
  id: string;
  code: string;
  name: string;
  currency: string;
  classification: Classification | null;
  statementGroup?: StatementGroup | null;
  branchId?: string | null;
  parentId?: string | null;
  description?: string | null;
  note?: string | null;
  vatApplicable: boolean;
};

type FormValues = {
  name: string;
  currency: string;
  classification: Classification;
  statementGroup: StatementGroup;
  branchId: string | null;
  parentId: string | null;
  description: string | null;
  note: string | null;
  vatApplicable: boolean;
};

type ActionResult = {
  success: boolean;
  error?: string;
};

export function AddAccountForm({
  statementGroup,
  groupLabel,
  branches,
  parents,
  onDone,
}: {
  statementGroup: StatementGroup;
  groupLabel: string;
  branches: BranchOption[];
  parents: ParentAccount[];
  onDone: () => void;
}) {
  return (
    <ClassifiedAccountForm
      title={
        <>
          Add account under{" "}
          <span style={{ color: "var(--accent)" }}>{groupLabel}</span>
        </>
      }
      initialValues={{
        name: "",
        currency: "KES",
        classification: "",
        statementGroup,
        branchId: "",
        parentId: "",
        description: "",
        note: "",
        vatApplicable: false,
      }}
      branches={branches}
      parents={parents}
      submitLabel="Save account"
      pendingLabel="Saving..."
      allowStatementGroupEdit={false}
      onDone={onDone}
      onSubmit={(values) =>
        createClassifiedAccount({
          name: values.name,
          currency: values.currency,
          classification: values.classification,
          statementGroup: values.statementGroup,
          branchId: values.branchId,
          parentId: values.parentId,
          description: values.description,
          note: values.note,
          vatApplicable: values.vatApplicable,
        })
      }
    />
  );
}

export function EditAccountForm({
  account,
  groupLabel,
  branches,
  parents,
  onDone,
}: {
  account: EditableAccount;
  groupLabel: string;
  branches: BranchOption[];
  parents: ParentAccount[];
  onDone: () => void;
}) {
  return (
    <ClassifiedAccountForm
      title={
        <>
          Edit{" "}
          <span style={{ color: "var(--accent)" }}>
            {account.code} - {account.name}
          </span>{" "}
          in {groupLabel}
        </>
      }
      initialValues={{
        name: account.name,
        currency: account.currency,
        classification: account.classification ?? "",
        statementGroup: account.statementGroup ?? "",
        branchId: account.branchId ?? "",
        parentId: account.parentId ?? "",
        description: account.description ?? "",
        note: account.note ?? "",
        vatApplicable: account.vatApplicable,
      }}
      branches={branches}
      parents={parents.filter((parent) => parent.id !== account.id)}
      submitLabel="Update account"
      pendingLabel="Updating..."
      allowStatementGroupEdit
      onDone={onDone}
      onSubmit={(values) =>
        updateClassifiedAccount({
          id: account.id,
          name: values.name,
          currency: values.currency,
          classification: values.classification,
          statementGroup: values.statementGroup,
          branchId: values.branchId,
          parentId: values.parentId,
          description: values.description,
          note: values.note,
          vatApplicable: values.vatApplicable,
        })
      }
    />
  );
}

function ClassifiedAccountForm({
  title,
  initialValues,
  branches,
  parents,
  submitLabel,
  pendingLabel,
  allowStatementGroupEdit,
  onDone,
  onSubmit,
}: {
  title: React.ReactNode;
  initialValues: {
    name: string;
    currency: string;
    classification: Classification | "";
    statementGroup: StatementGroup | "";
    branchId: string;
    parentId: string;
    description: string;
    note: string;
    vatApplicable: boolean;
  };
  branches: BranchOption[];
  parents: ParentAccount[];
  submitLabel: string;
  pendingLabel: string;
  allowStatementGroupEdit: boolean;
  onDone: () => void;
  onSubmit: (values: FormValues) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialValues.name);
  const [currency, setCurrency] = useState(initialValues.currency);
  const [classification, setClassification] = useState<Classification | "">(
    initialValues.classification,
  );
  const [statementGroup, setStatementGroup] = useState<StatementGroup | "">(
    initialValues.statementGroup,
  );
  const [branchId, setBranchId] = useState(initialValues.branchId);
  const [parentId, setParentId] = useState(initialValues.parentId);
  const [description, setDescription] = useState(initialValues.description);
  const [note, setNote] = useState(initialValues.note);
  const [vatApplicable, setVatApplicable] = useState(
    initialValues.vatApplicable,
  );
  const [error, setError] = useState<string | null>(null);

  function changeClassification(value: string) {
    const nextClassification = value as Classification | "";
    setClassification(nextClassification);
    if (allowStatementGroupEdit && nextClassification) {
      setStatementGroup(CLASSIFICATION_MAP[nextClassification].group);
    }
  }

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
    if (!statementGroup) {
      setError("Pick a report category");
      return;
    }

    startTransition(async () => {
      const result = await onSubmit({
        name,
        currency,
        classification,
        statementGroup,
        branchId: branchId || null,
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
      setError(result.error || "Could not save account");
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
        {title}
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
            onChange={(event) => changeClassification(event.target.value)}
          >
            <option value="">Select...</option>
            {CLASSIFICATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        {allowStatementGroupEdit && (
          <Field label="Report category *">
            <select
              style={inputStyle}
              value={statementGroup}
              onChange={(event) =>
                setStatementGroup(event.target.value as StatementGroup)
              }
            >
              <option value="">Select...</option>
              {STATEMENT_GROUPS.map((group) => (
                <option key={group.key} value={group.key}>
                  {group.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Branch">
          <select
            style={inputStyle}
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
          >
            <option value="">Unassigned</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
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
          {pending ? pendingLabel : submitLabel}
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
