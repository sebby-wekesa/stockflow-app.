import type { PostingLine } from "./posting";

export const VAT_RATE = 0.16;

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function splitVatInclusive(amount: number, hasVat: boolean) {
  const gross = round2(amount);
  if (!hasVat) return { net: gross, vat: 0, gross };

  const net = round2(gross / (1 + VAT_RATE));
  return { net, vat: round2(gross - net), gross };
}

function vatLine(
  accountId: string | undefined,
  amount: number,
  side: "debit" | "credit",
): PostingLine[] {
  if (amount === 0) return [];
  if (!accountId) throw new Error("The required VAT account is missing");
  return [{ accountId, [side]: amount, description: side === "debit" ? "VAT input" : "VAT output" }];
}

export function buildExpenseLines(input: {
  amount: number;
  hasVat: boolean;
  expenseAccountId: string;
  bankAccountId: string;
  vatInputAccountId?: string;
  memo?: string;
}): PostingLine[] {
  const { net, vat, gross } = splitVatInclusive(input.amount, input.hasVat);
  return [
    { accountId: input.expenseAccountId, debit: net, description: input.memo },
    ...vatLine(input.vatInputAccountId, vat, "debit"),
    { accountId: input.bankAccountId, credit: gross, description: "Paid" },
  ];
}

export function buildIncomeLines(input: {
  amount: number;
  hasVat: boolean;
  incomeAccountId: string;
  bankAccountId: string;
  vatOutputAccountId?: string;
  memo?: string;
}): PostingLine[] {
  const { net, vat, gross } = splitVatInclusive(input.amount, input.hasVat);
  return [
    { accountId: input.bankAccountId, debit: gross, description: "Received" },
    ...vatLine(input.vatOutputAccountId, vat, "credit"),
    { accountId: input.incomeAccountId, credit: net, description: input.memo },
  ];
}

export function buildBillLines(input: {
  amount: number;
  hasVat: boolean;
  purchaseAccountId: string;
  payableAccountId: string;
  vatInputAccountId?: string;
  memo?: string;
  supplierName?: string;
}): PostingLine[] {
  const { net, vat, gross } = splitVatInclusive(input.amount, input.hasVat);
  return [
    { accountId: input.purchaseAccountId, debit: net, description: input.memo },
    ...vatLine(input.vatInputAccountId, vat, "debit"),
    {
      accountId: input.payableAccountId,
      credit: gross,
      description: input.supplierName
        ? `Owed to ${input.supplierName}`
        : "Accounts payable",
    },
  ];
}

export function buildInvoiceLines(input: {
  amount: number;
  hasVat: boolean;
  receivableAccountId: string;
  salesAccountId: string;
  vatOutputAccountId?: string;
  memo?: string;
  customerName?: string;
}): PostingLine[] {
  const { net, vat, gross } = splitVatInclusive(input.amount, input.hasVat);
  return [
    {
      accountId: input.receivableAccountId,
      debit: gross,
      description: input.customerName
        ? `Due from ${input.customerName}`
        : "Accounts receivable",
    },
    ...vatLine(input.vatOutputAccountId, vat, "credit"),
    { accountId: input.salesAccountId, credit: net, description: input.memo },
  ];
}

export function buildTransferLines(input: {
  amount: number;
  fromAccountId: string;
  toAccountId: string;
  memo?: string;
}): PostingLine[] {
  return [
    { accountId: input.toAccountId, debit: round2(input.amount), description: input.memo || "Transfer in" },
    { accountId: input.fromAccountId, credit: round2(input.amount), description: input.memo || "Transfer out" },
  ];
}

export function buildEquityLines(input: {
  kind: "CAPITAL" | "DRAWINGS";
  amount: number;
  equityAccountId: string;
  bankAccountId: string;
  memo?: string;
}): PostingLine[] {
  const amount = round2(input.amount);
  return input.kind === "CAPITAL"
    ? [
        { accountId: input.bankAccountId, debit: amount, description: "Capital introduced" },
        { accountId: input.equityAccountId, credit: amount, description: input.memo },
      ]
    : [
        { accountId: input.equityAccountId, debit: amount, description: input.memo },
        { accountId: input.bankAccountId, credit: amount, description: "Withdrawn" },
      ];
}

export type EmployeeCashBookKind =
  | "ADVANCE_PAID"
  | "ADVANCE_REPAID"
  | "REIMBURSEMENT_PAID";

export function buildEmployeeCashBookLines(input: {
  kind: EmployeeCashBookKind;
  amount: number;
  bankAccountId: string;
  employeeReceivableAccountId?: string;
  employeePayableAccountId?: string;
  memo?: string;
}): PostingLine[] {
  const amount = round2(input.amount);

  if (input.kind === "ADVANCE_PAID") {
    if (!input.employeeReceivableAccountId) {
      throw new Error("Employee receivables account is missing");
    }
    return [
      {
        accountId: input.employeeReceivableAccountId,
        debit: amount,
        description: input.memo || "Employee advance",
      },
      {
        accountId: input.bankAccountId,
        credit: amount,
        description: "Paid from cash account",
      },
    ];
  }

  if (input.kind === "ADVANCE_REPAID") {
    if (!input.employeeReceivableAccountId) {
      throw new Error("Employee receivables account is missing");
    }
    return [
      {
        accountId: input.bankAccountId,
        debit: amount,
        description: "Received into cash account",
      },
      {
        accountId: input.employeeReceivableAccountId,
        credit: amount,
        description: input.memo || "Employee advance repayment",
      },
    ];
  }

  if (!input.employeePayableAccountId) {
    throw new Error("Employee payables account is missing");
  }
  return [
    {
      accountId: input.employeePayableAccountId,
      debit: amount,
      description: input.memo || "Employee reimbursement paid",
    },
    {
      accountId: input.bankAccountId,
      credit: amount,
      description: "Paid from cash account",
    },
  ];
}
