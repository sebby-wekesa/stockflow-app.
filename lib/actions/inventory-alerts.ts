"use server";

import { prisma } from "@/lib/prisma";

export async function getLowStockAlerts(threshold = 500) {
  const lowStockItems = await prisma.rawMaterial.findMany({
    where: {
      availableKg: { lt: threshold }
    },
    include: {
      supplier: true,
    }
  });

  return lowStockItems.map(item => ({
    ...item,
    urgency: item.availableKg < 100 ? 'HIGH' : 'LOW',
  }));
}