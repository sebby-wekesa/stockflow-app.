// lib/actions/alerts.ts
"use server";

import { prisma } from "@/lib/prisma";

export async function getLowStockAlerts() {
  // Logic: Find materials where available stock is less than 500kg 
  // (Or whatever your business safety buffer is)
  const threshold = 500.0; 

  const lowStockItems = await prisma.rawMaterial.findMany({
    where: {
      availableKg: {
        lt: threshold,
      },
    },
    include: {
      supplier: true,
    },
  });

  return lowStockItems.map(item => ({
    ...item,
    status: item.availableKg === 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
    urgency: item.availableKg < (threshold / 2) ? "HIGH" : "MEDIUM",
  }));
}