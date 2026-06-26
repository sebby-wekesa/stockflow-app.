import type { Prisma } from "@prisma/client";
import {
  alreadyPosted,
  getSystemAccounts,
  postJournalEntry,
  SYSTEM_ACCOUNT_KEYS,
} from "./posting";

type AccountingDb = Pick<
  Prisma.TransactionClient,
  "branch" | "chartAccount" | "journalEntry"
>;

type PostedSale = {
  id: string;
  totalAmount: number;
  date: Date;
  orderNumber?: string;
  branchId?: string | null;
};

export async function postSaleToLedger(
  db: AccountingDb,
  organizationId: string,
  sale: PostedSale,
  userId?: string,
): Promise<{ posted: boolean; reason?: string }> {
  if (await alreadyPosted(db, "SALE", "SaleOrder", sale.id)) {
    return { posted: false, reason: "already posted" };
  }

  const systemAccounts = await getSystemAccounts(db);
  const receivableId =
    systemAccounts[SYSTEM_ACCOUNT_KEYS.ACCOUNTS_RECEIVABLE];
  const salesRevenueId = systemAccounts[SYSTEM_ACCOUNT_KEYS.SALES_REVENUE];
  if (!receivableId || !salesRevenueId) {
    return { posted: false, reason: "system accounts missing" };
  }

  const amount = Number(sale.totalAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { posted: false, reason: "zero amount" };
  }

  await postJournalEntry(
    db,
    organizationId,
    {
      date: sale.date,
      memo: `Sale ${sale.orderNumber ?? sale.id}`,
      source: "SALE",
      sourceType: "SaleOrder",
      sourceId: sale.id,
      branchId: sale.branchId ?? null,
      lines: [
        {
          accountId: receivableId,
          debit: amount,
          description: "Accounts receivable",
        },
        {
          accountId: salesRevenueId,
          credit: amount,
          description: "Sales revenue",
        },
      ],
    },
    userId,
  );
  return { posted: true };
}

export async function voidSalePosting(
  db: AccountingDb,
  saleId: string,
): Promise<void> {
  await db.journalEntry.updateMany({
    where: {
      source: "SALE",
      sourceType: "SaleOrder",
      sourceId: saleId,
      status: "POSTED",
    },
    data: { status: "VOID" },
  });
}
