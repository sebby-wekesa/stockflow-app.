"use server";

import { prisma } from "@/lib/prisma";

export async function exportYieldToCSV() {
  const orders = await prisma.productionOrder.findMany({
    include: {
      design: true,
      logs: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  // Define CSV Headers
  const headers = ["Order ID", "Design", "Input (kg)", "Output (kg)", "Scrap (kg)", "Yield %", "Date"];

  const rows = orders.map(order => {
    const totalIn = order.logs.reduce((sum, l) => sum + l.kgIn, 0);
    const totalOut = order.logs.reduce((sum, l) => sum + l.kgOut, 0);
    const totalScrap = order.logs.reduce((sum, l) => sum + l.kgScrap, 0);
    const yieldPerc = totalIn > 0 ? ((totalOut / totalIn) * 100).toFixed(2) : 0;

    return [
      order.id,
      order.design.name,
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