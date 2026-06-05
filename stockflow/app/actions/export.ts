"use server";

import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";

export async function exportYieldToCSV() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const orders = await db.productionOrder.findMany({
    include: {
      design: true,
      StageLog: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  // Define CSV Headers
  const headers = ["Order ID", "Design", "Input (kg)", "Output (kg)", "Scrap (kg)", "Yield %", "Date"];

  const rows = orders.map(order => {
    const totalIn = order.StageLog.reduce((sum, l) => sum + l.kgIn.toNumber(), 0);
    const totalOut = order.StageLog.reduce((sum, l) => sum + l.kgOut.toNumber(), 0);
    const totalScrap = order.StageLog.reduce((sum, l) => sum + l.kgScrap.toNumber(), 0);
    const yieldPerc = totalIn > 0 ? ((totalOut / totalIn) * 100).toFixed(2) : 0;

    return [
      order.id,
      order.design?.name ?? order.productName ?? "Direct order",
      totalIn,
      totalOut,
      totalScrap,
      `${yieldPerc}%`,
      order.createdAt.toLocaleDateString()
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\n");
  return csvContent;
}
