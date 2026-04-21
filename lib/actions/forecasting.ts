"use server";

import { prisma } from "@/lib/prisma";

export async function getReorderSuggestions() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 1. Get all raw materials
  const materials = await prisma.rawMaterial.findMany({
    include: { supplier: true }
  });

  // 2. Calculate average consumption per material over 30 days
  const suggestions = await Promise.all(materials.map(async (material) => {
    const transactions = await prisma.stockTransaction.aggregate({
      where: {
        itemId: material.id,
        itemType: 'raw',
        transactionType: 'consumption',
        createdAt: { gte: thirtyDaysAgo }
      },
      _sum: { quantity: true }
    });

    const totalConsumed = transactions._sum.quantity || 0;
    const dailyBurnRate = totalConsumed / 30;
    const daysRemaining = dailyBurnRate > 0 ? material.availableKg / dailyBurnRate : 999;

    // Suggest a reorder if we have less than 14 days of stock left
    const shouldReorder = daysRemaining < 14;
    const suggestedQty = dailyBurnRate * 30; // Aim for a 30-day supply

    return {
      id: material.id,
      name: material.materialName,
      diameter: material.diameter,
      currentStock: material.availableKg,
      dailyBurnRate: dailyBurnRate.toFixed(2),
      daysRemaining: Math.round(daysRemaining),
      suggestedReorderKg: shouldReorder ? Math.ceil(suggestedQty) : 0,
      supplier: material.supplier?.name
    };
  }));

  return suggestions.filter(s => s.suggestedReorderKg > 0);
}