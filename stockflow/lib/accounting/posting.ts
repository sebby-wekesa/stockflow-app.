import type { Prisma } from "@prisma/client";
import { SYSTEM_ACCOUNT_KEYS } from "./chart-of-accounts";

type AccountingDb = Pick<
  Prisma.TransactionClient,
  "chartAccount" | "journalEntry"
>;

export type PostingLine = {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string;
};

export type PostJournalInput = {
  date: Date;
  memo?: string;
  source?:
    | "MANUAL"
    | "SALE"
    | "PURCHASE"
    | "PAYMENT_RECEIVED"
    | "PAYMENT_MADE"
    | "OPENING_BALANCE";
  sourceType?: string | null;
  sourceId?: string | null;
  lines: PostingLine[];
};

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export async function nextJournalNumber(db: AccountingDb): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.journalEntry.findFirst({
    where: { entryNumber: { startsWith: `JE-${year}-` } },
    orderBy: { createdAt: "desc" },
    select: { entryNumber: true },
  });
  const match = last?.entryNumber.match(/JE-\d{4}-(\d+)/);
  const next = match ? Number.parseInt(match[1], 10) + 1 : 1;
  return `JE-${year}-${next.toString().padStart(6, "0")}`;
}

export async function postJournalEntry(
  db: AccountingDb,
  organizationId: string,
  input: PostJournalInput,
  userId?: string,
): Promise<{ id: string; entryNumber: string }> {
  if (Number.isNaN(input.date.getTime())) {
    throw new Error("Journal date is invalid");
  }

  const lines = (input.lines ?? [])
    .map((line) => ({
      ...line,
      debit: round2(Number(line.debit ?? 0)),
      credit: round2(Number(line.credit ?? 0)),
    }))
    .filter((line) => line.debit !== 0 || line.credit !== 0);

  if (lines.length < 2) {
    throw new Error("A journal entry needs at least two lines");
  }

  for (const line of lines) {
    if (!Number.isFinite(line.debit) || !Number.isFinite(line.credit)) {
      throw new Error("Debit and credit amounts must be valid numbers");
    }
    if (line.debit > 0 && line.credit > 0) {
      throw new Error("A line cannot have both a debit and a credit");
    }
    if (line.debit < 0 || line.credit < 0) {
      throw new Error("Debit and credit amounts must be positive");
    }
  }

  const accountIds = [...new Set(lines.map((line) => line.accountId))];
  const accounts = await db.chartAccount.findMany({
    where: { id: { in: accountIds }, isActive: true },
    select: { id: true },
  });
  if (accounts.length !== accountIds.length) {
    throw new Error(
      "Every journal line must use an active account from your organization",
    );
  }

  const totalDebit = round2(
    lines.reduce((sum, line) => sum + line.debit, 0),
  );
  const totalCredit = round2(
    lines.reduce((sum, line) => sum + line.credit, 0),
  );

  if (totalDebit !== totalCredit) {
    throw new Error(
      `Journal entry does not balance: debits ${totalDebit} do not equal credits ${totalCredit}`,
    );
  }
  if (totalDebit === 0) {
    throw new Error("Journal entry total cannot be zero");
  }

  const entryNumber = await nextJournalNumber(db);
  return db.journalEntry.create({
    data: {
      organizationId,
      entryNumber,
      date: input.date,
      memo: input.memo?.trim() || null,
      status: "POSTED",
      source: input.source ?? "MANUAL",
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      postedAt: new Date(),
      postedBy: userId ?? null,
      createdBy: userId ?? null,
      lines: {
        create: lines.map((line) => ({
          organizationId,
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          description: line.description?.trim() || null,
        })),
      },
    },
    select: { id: true, entryNumber: true },
  });
}

export async function getSystemAccounts(
  db: AccountingDb,
): Promise<Record<string, string>> {
  const accounts = await db.chartAccount.findMany({
    where: { isSystem: true, isActive: true },
    select: { id: true, description: true },
  });

  const map: Record<string, string> = {};
  for (const account of accounts) {
    const match = account.description?.match(/^key:([a-z_]+)$/);
    if (match) map[match[1]] = account.id;
  }
  return map;
}

export async function alreadyPosted(
  db: AccountingDb,
  source: PostJournalInput["source"],
  sourceType: string,
  sourceId: string,
): Promise<boolean> {
  const existing = await db.journalEntry.findFirst({
    where: { source, sourceType, sourceId, status: { not: "VOID" } },
    select: { id: true },
  });
  return Boolean(existing);
}

export { SYSTEM_ACCOUNT_KEYS };
