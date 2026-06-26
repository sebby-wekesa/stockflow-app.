"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  postBill,
  postEquityMovement,
  postExpense,
  postIncome,
  postInvoice,
  postTransfer,
} from "@/actions/accounting-transactions";

type AccountOption = { id: string; code: string; name: string };
type FormData = {
  expense: AccountOption[];
  income: AccountOption[];
  defaultSalesAccountId?: string | null;
  purchase: AccountOption[];
  capital: AccountOption[];
  drawings: AccountOption[];
  banks: { id: string; name: string }[];
  transferAccounts: AccountOption[];
};
type SubmitResult = {
  success: boolean;
  error?: string;
  entryNumber?: string;
};

const TABS = [
  { key: "expense", label: "Expense", hint: "Money paid out now" },
  { key: "income", label: "Income", hint: "Money received now, excluding customer sales" },
  { key: "invoice", label: "Sales Invoice", hint: "Post a manual credit sale to the ledger" },
  { key: "bill", label: "Bill / Purchase", hint: "Post a manual supplier bill to the ledger" },
  { key: "transfer", label: "Bank Transfer", hint: "Move money between cash and bank accounts" },
  { key: "equity", label: "Capital / Drawings", hint: "Record owner money moving in or out" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function TransactionsHub({ data }: { data: FormData }) {
  const [tab, setTab] = useState<TabKey>("expense");

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={tab === item.key}
            onClick={() => setTab(item.key)}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              border: "1px solid var(--border2)",
              background: tab === item.key ? "var(--accent)" : "var(--surface2)",
              color: tab === item.key ? "#fff" : "var(--muted)",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
        {TABS.find((item) => item.key === tab)?.hint}. Each transaction posts a
        balanced double-entry journal.
      </p>

      {tab === "expense" && <ExpenseForm data={data} />}
      {tab === "income" && <IncomeForm data={data} />}
      {tab === "invoice" && <InvoiceForm data={data} />}
      {tab === "bill" && <BillForm data={data} />}
      {tab === "transfer" && <TransferForm data={data} />}
      {tab === "equity" && <EquityForm data={data} />}
    </div>
  );
}

function useSubmit() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function run(action: () => Promise<SubmitResult>, onSuccess?: () => void) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.success) {
          setMessage({ ok: true, text: `Posted ${result.entryNumber}` });
          onSuccess?.();
          router.refresh();
        } else {
          setMessage({ ok: false, text: result.error || "Could not post transaction" });
        }
      } catch {
        setMessage({ ok: false, text: "Could not post transaction" });
      }
    });
  }

  return { pending, message, run };
}

function Message({ value }: { value: { ok: boolean; text: string } | null }) {
  if (!value) return null;
  return (
    <div
      role="status"
      style={{
        padding: "8px 12px",
        borderRadius: "var(--radius-sm)",
        marginBottom: 12,
        fontSize: 13,
        background: value.ok ? "rgba(46,125,50,0.12)" : "rgba(239,68,68,0.1)",
        color: value.ok ? "#2E7D32" : "#fca5a5",
      }}
    >
      {value.text}
    </div>
  );
}

function VatPreview({ amount, hasVat }: { amount: string; hasVat: boolean }) {
  const gross = Number.parseFloat(amount) || 0;
  if (!hasVat || gross <= 0) return null;
  const net = gross / 1.16;
  return (
    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
      Net {net.toFixed(2)} | VAT (16%) {(gross - net).toFixed(2)} | Gross{" "}
      {gross.toFixed(2)}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function AccountPicker({
  accounts,
  value,
  onChange,
  placeholder,
}: {
  accounts: AccountOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <select style={inputStyle} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.code} - {account.name}
        </option>
      ))}
    </select>
  );
}

function BankPicker({
  banks,
  value,
  onChange,
}: {
  banks: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select style={inputStyle} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Cash on hand</option>
      {banks.map((bank) => (
        <option key={bank.id} value={bank.id}>
          {bank.name}
        </option>
      ))}
    </select>
  );
}

function VatToggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", marginTop: 22 }}>
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      Includes 16% VAT
    </label>
  );
}

function PostButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <div style={{ marginTop: 14, textAlign: "right" }}>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Posting..." : label}
      </button>
    </div>
  );
}

function ExpenseForm({ data }: { data: FormData }) {
  const { pending, message, run } = useSubmit();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [bankId, setBankId] = useState("");
  const [hasVat, setHasVat] = useState(false);
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");

  return (
    <form
      className="card"
      style={cardStyle}
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () =>
            postExpense({
              date,
              amount: Number.parseFloat(amount),
              expenseAccountId: accountId,
              bankAccountId: bankId || null,
              hasVat,
              reference,
              memo,
            }),
          () => {
            setAmount("");
            setReference("");
            setMemo("");
          },
        );
      }}
    >
      <Message value={message} />
      <div style={gridStyle}>
        <DateField value={date} onChange={setDate} />
        <AmountField value={amount} onChange={setAmount} />
        <Field label="Expense account">
          <AccountPicker accounts={data.expense} value={accountId} onChange={setAccountId} placeholder="Select expense..." />
        </Field>
        <Field label="Paid from">
          <BankPicker banks={data.banks} value={bankId} onChange={setBankId} />
        </Field>
        <VatToggle value={hasVat} onChange={setHasVat} />
        <TextField label="Reference" value={reference} onChange={setReference} placeholder="Receipt or voucher no." />
        <TextField label="Memo" value={memo} onChange={setMemo} placeholder="What was this for?" />
      </div>
      <VatPreview amount={amount} hasVat={hasVat} />
      <PostButton pending={pending} label="Record expense" />
    </form>
  );
}

function IncomeForm({ data }: { data: FormData }) {
  const { pending, message, run } = useSubmit();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [bankId, setBankId] = useState("");
  const [hasVat, setHasVat] = useState(false);
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");

  return (
    <form
      className="card"
      style={cardStyle}
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () =>
            postIncome({
              date,
              amount: Number.parseFloat(amount),
              incomeAccountId: accountId,
              bankAccountId: bankId || null,
              hasVat,
              reference,
              memo,
            }),
          () => {
            setAmount("");
            setReference("");
            setMemo("");
          },
        );
      }}
    >
      <Message value={message} />
      <div style={gridStyle}>
        <DateField value={date} onChange={setDate} />
        <AmountField value={amount} onChange={setAmount} />
        <Field label="Income account">
          <AccountPicker accounts={data.income} value={accountId} onChange={setAccountId} placeholder="Select income..." />
        </Field>
        <Field label="Received into">
          <BankPicker banks={data.banks} value={bankId} onChange={setBankId} />
        </Field>
        <VatToggle value={hasVat} onChange={setHasVat} />
        <TextField label="Reference" value={reference} onChange={setReference} placeholder="Receipt or reference no." />
        <TextField label="Memo" value={memo} onChange={setMemo} placeholder="Income source" />
      </div>
      <VatPreview amount={amount} hasVat={hasVat} />
      <PostButton pending={pending} label="Record income" />
    </form>
  );
}

function InvoiceForm({ data }: { data: FormData }) {
  const { pending, message, run } = useSubmit();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(data.defaultSalesAccountId ?? "");
  const [customerName, setCustomerName] = useState("");
  const [hasVat, setHasVat] = useState(true);
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");

  return (
    <form
      className="card"
      style={cardStyle}
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () =>
            postInvoice({
              date,
              amount: Number.parseFloat(amount),
              salesAccountId: accountId || null,
              customerName,
              hasVat,
              reference,
              memo,
            }),
          () => {
            setAmount("");
            setAccountId(data.defaultSalesAccountId ?? "");
            setCustomerName("");
            setReference("");
            setMemo("");
          },
        );
      }}
    >
      <Message value={message} />
      <div style={gridStyle}>
        <DateField value={date} onChange={setDate} />
        <AmountField value={amount} onChange={setAmount} />
        <Field label="Revenue / income account">
          <AccountPicker accounts={data.income} value={accountId} onChange={setAccountId} placeholder="Select income..." />
        </Field>
        <TextField label="Customer" value={customerName} onChange={setCustomerName} placeholder="Customer name" />
        <VatToggle value={hasVat} onChange={setHasVat} />
        <TextField label="Invoice number" value={reference} onChange={setReference} placeholder="INV-001" />
        <TextField label="Memo" value={memo} onChange={setMemo} placeholder="Invoice description" />
      </div>
      <VatPreview amount={amount} hasVat={hasVat} />
      <PostButton pending={pending} label="Post invoice" />
    </form>
  );
}

function BillForm({ data }: { data: FormData }) {
  const { pending, message, run } = useSubmit();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [hasVat, setHasVat] = useState(true);
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");

  return (
    <form
      className="card"
      style={cardStyle}
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () =>
            postBill({
              date,
              amount: Number.parseFloat(amount),
              purchaseAccountId: accountId,
              supplierName,
              hasVat,
              reference,
              memo,
            }),
          () => {
            setAmount("");
            setSupplierName("");
            setReference("");
            setMemo("");
          },
        );
      }}
    >
      <Message value={message} />
      <div style={gridStyle}>
        <DateField value={date} onChange={setDate} />
        <AmountField value={amount} onChange={setAmount} />
        <Field label="Expense or asset account">
          <AccountPicker accounts={data.purchase} value={accountId} onChange={setAccountId} placeholder="Select account..." />
        </Field>
        <TextField label="Supplier" value={supplierName} onChange={setSupplierName} placeholder="Supplier name" />
        <VatToggle value={hasVat} onChange={setHasVat} />
        <TextField label="Bill number" value={reference} onChange={setReference} placeholder="BILL-001" />
        <TextField label="Memo" value={memo} onChange={setMemo} placeholder="Purchase description" />
      </div>
      <VatPreview amount={amount} hasVat={hasVat} />
      <PostButton pending={pending} label="Post bill" />
    </form>
  );
}

function TransferForm({ data }: { data: FormData }) {
  const { pending, message, run } = useSubmit();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");

  return (
    <form
      className="card"
      style={cardStyle}
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () =>
            postTransfer({
              date,
              amount: Number.parseFloat(amount),
              fromAccountId,
              toAccountId,
              reference,
              memo,
            }),
          () => {
            setAmount("");
            setReference("");
            setMemo("");
          },
        );
      }}
    >
      <Message value={message} />
      <div style={gridStyle}>
        <DateField value={date} onChange={setDate} />
        <AmountField value={amount} onChange={setAmount} />
        <Field label="From account">
          <AccountPicker accounts={data.transferAccounts} value={fromAccountId} onChange={setFromAccountId} placeholder="Select source..." />
        </Field>
        <Field label="To account">
          <AccountPicker accounts={data.transferAccounts} value={toAccountId} onChange={setToAccountId} placeholder="Select destination..." />
        </Field>
        <TextField label="Reference" value={reference} onChange={setReference} placeholder="Transfer reference" />
        <TextField label="Memo" value={memo} onChange={setMemo} placeholder="Transfer reason" />
      </div>
      <PostButton pending={pending} label="Post transfer" />
    </form>
  );
}

function EquityForm({ data }: { data: FormData }) {
  const { pending, message, run } = useSubmit();
  const [kind, setKind] = useState<"CAPITAL" | "DRAWINGS">("CAPITAL");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [bankId, setBankId] = useState("");
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const accounts = kind === "CAPITAL" ? data.capital : data.drawings;

  return (
    <form
      className="card"
      style={cardStyle}
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () =>
            postEquityMovement({
              kind,
              date,
              amount: Number.parseFloat(amount),
              equityAccountId: accountId,
              bankAccountId: bankId || null,
              reference,
              memo,
            }),
          () => {
            setAmount("");
            setReference("");
            setMemo("");
          },
        );
      }}
    >
      <Message value={message} />
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["CAPITAL", "DRAWINGS"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value);
              setAccountId("");
            }}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              border: "1px solid var(--border2)",
              background: kind === value ? "var(--accent)" : "var(--surface2)",
              color: kind === value ? "#fff" : "var(--muted)",
            }}
          >
            {value === "CAPITAL" ? "Capital in" : "Drawings out"}
          </button>
        ))}
      </div>
      <div style={gridStyle}>
        <DateField value={date} onChange={setDate} />
        <AmountField value={amount} onChange={setAmount} />
        <Field label={kind === "CAPITAL" ? "Capital account" : "Drawings account"}>
          <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} placeholder="Select equity account..." />
        </Field>
        <Field label={kind === "CAPITAL" ? "Received into" : "Paid from"}>
          <BankPicker banks={data.banks} value={bankId} onChange={setBankId} />
        </Field>
        <TextField label="Reference" value={reference} onChange={setReference} placeholder="Reference" />
        <TextField label="Memo" value={memo} onChange={setMemo} placeholder="Note" />
      </div>
      <PostButton pending={pending} label={kind === "CAPITAL" ? "Record capital" : "Record drawings"} />
    </form>
  );
}

function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field label="Date">
      <input required type="date" style={inputStyle} value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function AmountField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field label="Amount (KES)">
      <input required type="number" min={0.01} step="0.01" style={inputStyle} value={value} onChange={(event) => onChange(event.target.value)} placeholder="0.00" />
    </Field>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Field label={label}>
      <input style={inputStyle} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </Field>
  );
}

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

const cardStyle: React.CSSProperties = { padding: 20 };
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: 4,
  display: "block",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  fontSize: 14,
};
