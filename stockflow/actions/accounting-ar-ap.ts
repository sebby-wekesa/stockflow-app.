"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  getSystemAccounts,
  postJournalEntry,
  SYSTEM_ACCOUNT_KEYS,
} from "@/lib/accounting/posting";
import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";

const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "MPESA",
  "CHEQUE",
  "CARD",
  "OTHER",
] as const;

function parseDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getDebtors() {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const db = getTenantPrisma(user.organizationId);
  const [customers, payments] = await Promise.all([
    db.customer.findMany({
      orderBy: { name: "asc" },
      include: {
        SaleOrder: {
          where: {
            status: { in: ["CONFIRMED", "READY_FOR_DISPATCH", "SHIPPED"] },
          },
          select: { totalAmount: true },
        },
      },
    }),
    db.payment.findMany({
      where: { direction: "RECEIVED" },
      select: { customerId: true, amount: true },
    }),
  ]);

  const paidByCustomer = new Map<string, number>();
  for (const payment of payments) {
    if (!payment.customerId) continue;
    paidByCustomer.set(
      payment.customerId,
      (paidByCustomer.get(payment.customerId) ?? 0) + Number(payment.amount),
    );
  }

  const rows = customers.map((customer) => {
    const billed = customer.SaleOrder.reduce(
      (sum, sale) => sum + Number(sale.totalAmount),
      0,
    );
    const paid = paidByCustomer.get(customer.id) ?? 0;
    return {
      id: customer.id,
      name: customer.name,
      code: customer.code,
      phone: customer.phone,
      billed: Math.round(billed * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      outstanding: Math.round((billed - paid) * 100) / 100,
    };
  });
  const visibleRows = rows.filter((row) => row.billed !== 0 || row.paid !== 0);
  return {
    rows: visibleRows,
    totalOutstanding:
      Math.round(
        visibleRows.reduce((sum, row) => sum + row.outstanding, 0) * 100,
      ) / 100,
  };
}

export async function getCreditors() {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const db = getTenantPrisma(user.organizationId);
  const [suppliers, payments] = await Promise.all([
    db.supplier.findMany({
      orderBy: { name: "asc" },
      include: {
        PurchaseOrder: {
          where: { status: { in: ["APPROVED", "ORDERED", "RECEIVED"] } },
          select: { totalAmount: true },
        },
      },
    }),
    db.payment.findMany({
      where: { direction: "PAID" },
      select: { supplierId: true, amount: true },
    }),
  ]);

  const paidBySupplier = new Map<string, number>();
  for (const payment of payments) {
    if (!payment.supplierId) continue;
    paidBySupplier.set(
      payment.supplierId,
      (paidBySupplier.get(payment.supplierId) ?? 0) + Number(payment.amount),
    );
  }

  const rows = suppliers.map((supplier) => {
    const billed = supplier.PurchaseOrder.reduce(
      (sum, purchase) => sum + Number(purchase.totalAmount),
      0,
    );
    const paid = paidBySupplier.get(supplier.id) ?? 0;
    return {
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      phone: supplier.phone,
      billed: Math.round(billed * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      outstanding: Math.round((billed - paid) * 100) / 100,
    };
  });
  const visibleRows = rows.filter((row) => row.billed !== 0 || row.paid !== 0);
  return {
    rows: visibleRows,
    totalOutstanding:
      Math.round(
        visibleRows.reduce((sum, row) => sum + row.outstanding, 0) * 100,
      ) / 100,
  };
}

export async function listPaymentParties() {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const db = getTenantPrisma(user.organizationId);
  const [customers, suppliers] = await Promise.all([
    db.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { customers, suppliers };
}

export async function listBankAccounts() {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const db = getTenantPrisma(user.organizationId);
  const banks = await db.bankAccount.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { account: { select: { code: true } } },
  });

  return Promise.all(
    banks.map(async (bank) => {
      const totals = await db.ledgerLine.aggregate({
        where: {
          accountId: bank.accountId,
          journalEntry: { status: "POSTED" },
        },
        _sum: { debit: true, credit: true },
      });
      const net =
        Number(totals._sum.debit ?? 0) - Number(totals._sum.credit ?? 0);
      return {
        id: bank.id,
        name: bank.name,
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        currency: bank.currency,
        glCode: bank.account.code,
        balance:
          Math.round((Number(bank.openingBalance) + net) * 100) / 100,
      };
    }),
  );
}

export async function createBankAccount(input: {
  name: string;
  bankName?: string;
  accountNumber?: string;
  glAccountId: string;
  openingBalance?: number;
}) {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const db = getTenantPrisma(user.organizationId);
  const name = input.name.trim();
  const openingBalance = Number(input.openingBalance ?? 0);
  if (!name) return { success: false, error: "Account name is required" };
  if (!Number.isFinite(openingBalance)) {
    return { success: false, error: "Opening balance must be a valid number" };
  }

  const glAccount = await db.chartAccount.findFirst({
    where: { id: input.glAccountId, isActive: true },
  });
  if (!glAccount) return { success: false, error: "Pick a valid GL account" };
  if (glAccount.type !== "ASSET") {
    return {
      success: false,
      error: "Bank accounts must map to an asset account",
    };
  }
  const exists = await db.bankAccount.findFirst({
    where: { accountId: input.glAccountId },
  });
  if (exists) {
    return {
      success: false,
      error: "That GL account is already a bank account",
    };
  }

  const bank = await withTenantTransaction(user.organizationId, async (tx) => {
    const created = await tx.bankAccount.create({
      data: {
        organizationId: user.organizationId,
        accountId: input.glAccountId,
        name,
        bankName: input.bankName?.trim() || null,
        accountNumber: input.accountNumber?.trim() || null,
        openingBalance,
      },
    });
    await tx.chartAccount.update({
      where: { id: input.glAccountId },
      data: { isBank: true },
    });
    return created;
  });

  revalidatePath("/accounting");
  revalidatePath("/accounting/banking");
  return { success: true, bankAccountId: bank.id };
}

async function nextPaymentNumber(
  tx: any,
  direction: "RECEIVED" | "PAID",
): Promise<string> {
  const prefix = direction === "RECEIVED" ? "RCT" : "PMT";
  const year = new Date().getFullYear();
  const last = await tx.payment.findFirst({
    where: { direction, paymentNumber: { startsWith: `${prefix}-${year}-` } },
    orderBy: { createdAt: "desc" },
    select: { paymentNumber: true },
  });
  const match = last?.paymentNumber.match(new RegExp(`${prefix}-\\d{4}-(\\d+)`));
  const next = match ? Number.parseInt(match[1], 10) + 1 : 1;
  return `${prefix}-${year}-${next.toString().padStart(6, "0")}`;
}

export async function recordPayment(input: {
  direction: "RECEIVED" | "PAID";
  amount: number;
  date: string;
  method?: (typeof PAYMENT_METHODS)[number];
  customerId?: string | null;
  supplierId?: string | null;
  bankAccountId?: string | null;
  reference?: string;
  notes?: string;
}) {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const amount = Number(input.amount);
  const date = parseDate(input.date);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Amount must be positive" };
  }
  if (!date) return { success: false, error: "Enter a valid payment date" };
  if (input.method && !PAYMENT_METHODS.includes(input.method)) {
    return { success: false, error: "Payment method is invalid" };
  }
  if (input.direction === "RECEIVED" && !input.customerId) {
    return { success: false, error: "Select the customer who paid" };
  }
  if (input.direction === "PAID" && !input.supplierId) {
    return { success: false, error: "Select the supplier being paid" };
  }

  try {
    const result = await withTenantTransaction(
      user.organizationId,
      async (tx) => {
        if (input.direction === "RECEIVED") {
          const customer = await tx.customer.findFirst({
            where: { id: input.customerId! },
            select: { id: true },
          });
          if (!customer) throw new Error("Customer not found in your organization");
        } else {
          const supplier = await tx.supplier.findFirst({
            where: { id: input.supplierId! },
            select: { id: true },
          });
          if (!supplier) throw new Error("Supplier not found in your organization");
        }

        const systemAccounts = await getSystemAccounts(tx);
        const receivableId =
          systemAccounts[SYSTEM_ACCOUNT_KEYS.ACCOUNTS_RECEIVABLE];
        const payableId = systemAccounts[SYSTEM_ACCOUNT_KEYS.ACCOUNTS_PAYABLE];
        const cashId = systemAccounts[SYSTEM_ACCOUNT_KEYS.CASH];

        let bankAccountId = input.bankAccountId ?? null;
        let bankGlId: string | undefined;
        if (bankAccountId) {
          const bank = await tx.bankAccount.findFirst({
            where: { id: bankAccountId, isActive: true },
            select: { accountId: true },
          });
          if (!bank) {
            throw new Error("Bank account not found in your organization");
          }
          bankGlId = bank.accountId;
        } else {
          bankGlId = cashId;
          bankAccountId = null;
        }

        if (!bankGlId) {
          throw new Error("No cash account found. Set up the chart of accounts first.");
        }
        if (input.direction === "RECEIVED" && !receivableId) {
          throw new Error("Accounts receivable is missing. Set up the chart of accounts.");
        }
        if (input.direction === "PAID" && !payableId) {
          throw new Error("Accounts payable is missing. Set up the chart of accounts.");
        }

        const paymentNumber = await nextPaymentNumber(tx, input.direction);
        const lines =
          input.direction === "RECEIVED"
            ? [
                {
                  accountId: bankGlId,
                  debit: amount,
                  description: "Payment received",
                },
                {
                  accountId: receivableId!,
                  credit: amount,
                  description: "Settle debtor",
                },
              ]
            : [
                {
                  accountId: payableId!,
                  debit: amount,
                  description: "Settle creditor",
                },
                {
                  accountId: bankGlId,
                  credit: amount,
                  description: "Payment made",
                },
              ];

        const entry = await postJournalEntry(
          tx,
          user.organizationId,
          {
            date,
            memo: `${input.direction === "RECEIVED" ? "Receipt" : "Payment"} ${paymentNumber}`,
            source:
              input.direction === "RECEIVED"
                ? "PAYMENT_RECEIVED"
                : "PAYMENT_MADE",
            sourceType: "Payment",
            sourceId: paymentNumber,
            lines,
          },
          user.id,
        );
        const payment = await tx.payment.create({
          data: {
            organizationId: user.organizationId,
            paymentNumber,
            direction: input.direction,
            method: input.method ?? "BANK_TRANSFER",
            date,
            amount,
            reference: input.reference?.trim() || null,
            notes: input.notes?.trim() || null,
            customerId:
              input.direction === "RECEIVED" ? input.customerId : null,
            supplierId: input.direction === "PAID" ? input.supplierId : null,
            bankAccountId,
            journalEntryId: entry.id,
            createdBy: user.id,
          },
        });
        return {
          paymentNumber: payment.paymentNumber,
          entryNumber: entry.entryNumber,
        };
      },
    );

    revalidatePath("/accounting");
    revalidatePath("/accounting/debtors");
    revalidatePath("/accounting/creditors");
    revalidatePath("/accounting/banking");
    revalidatePath("/accounting/ledger");
    revalidatePath("/accounting/trial-balance");
    return { success: true, ...result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not record payment",
    };
  }
}
