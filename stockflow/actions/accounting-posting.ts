"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { postSaleToLedger } from "@/lib/accounting/sales-posting";
import { withTenantTransaction } from "@/lib/tenant-prisma";

export async function backfillSalesPostings() {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");

  const result = await withTenantTransaction(
    user.organizationId,
    async (tx) => {
      const sales = await tx.saleOrder.findMany({
        where: {
          status: { in: ["CONFIRMED", "READY_FOR_DISPATCH", "SHIPPED"] },
        },
        select: { id: true, totalAmount: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      let posted = 0;
      let skipped = 0;
      for (const sale of sales) {
        const posting = await postSaleToLedger(
          tx,
          user.organizationId,
          {
            id: sale.id,
            totalAmount: Number(sale.totalAmount),
            date: sale.createdAt,
          },
          user.id,
        );
        if (posting.posted) posted += 1;
        else skipped += 1;
      }

      return { posted, skipped, total: sales.length };
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  revalidatePath("/accounting");
  revalidatePath("/accounting/ledger");
  revalidatePath("/accounting/trial-balance");
  return { success: true, ...result };
}
