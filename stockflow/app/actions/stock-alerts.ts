"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { subDays, startOfDay, endOfDay } from "date-fns";

export interface LowStockAlert {
  materialId: string;
  materialName: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  dailyConsumptionRate: number;
  daysRemaining: number;
  alertLevel: 'critical' | 'warning' | 'info';
  recommendedOrderKg: number;
}

export async function getLowStockAlerts(): Promise<LowStockAlert[]> {
  const user = await requireAuth();

  const thirtyDaysAgo = subDays(new Date(), 30);
  const alerts: LowStockAlert[] = [];

  // Get all raw materials with BOM consumption data
  const materials = await prisma.rawMaterial.findMany({
    include: {
      consumptionLogs: {
        where: {
          consumedAt: { gte: thirtyDaysAgo }
        }
      },
      bomItems: {
        include: {
          design: {
            include: {
              productionOrders: {
                where: {
                  status: { in: ['PENDING', 'APPROVED', 'IN_PRODUCTION'] },
                  createdAt: { gte: thirtyDaysAgo }
                }
              }
            }
          }
        }
      }
    }
  });

  for (const material of materials) {
    // Calculate daily consumption rate from BOM consumption logs
    const totalConsumedKg = material.consumptionLogs.reduce((sum, log) => {
      return sum + Number(log.quantityConsumed);
    }, 0);

    // Also consider pending/approved orders that will consume materials
    const pendingConsumption = material.bomItems.reduce((sum, bomItem) => {
      const pendingOrders = bomItem.design.productionOrders.length;
      return sum + (Number(bomItem.quantity) * pendingOrders);
    }, 0);

    // Estimate future consumption (assume 50% of pending orders will be completed in next 30 days)
    const estimatedFutureConsumption = pendingConsumption * 0.5;

    const totalEstimatedConsumption = totalConsumedKg + estimatedFutureConsumption;
    const daysInPeriod = 30;
    const dailyConsumptionRate = totalEstimatedConsumption / daysInPeriod;

    // Calculate days remaining based on available stock
    const availableStock = Number(material.availableKg);
    const daysRemaining = dailyConsumptionRate > 0 ? availableStock / dailyConsumptionRate : Infinity;

    // Determine alert level
    let alertLevel: 'critical' | 'warning' | 'info' = 'info';
    if (daysRemaining <= 3) {
      alertLevel = 'critical';
    } else if (daysRemaining <= 7) {
      alertLevel = 'warning';
    }

    // Only include materials that need attention
    if (daysRemaining <= 14 || availableStock < 500) { // Alert if stock is below 500kg or days remaining ≤ 14
      // Calculate recommended order quantity (enough for 45 days + safety buffer)
      const safetyBufferDays = 15; // Extra buffer for unexpected demand
      const recommendedOrderKg = Math.max(
        (dailyConsumptionRate * (30 + safetyBufferDays)) - availableStock,
        dailyConsumptionRate * 7 // Minimum order for 1 week
      );

      alerts.push({
        materialId: material.id,
        materialName: material.materialName,
        currentStock: Number(material.availableKg) + Number(material.reservedKg),
        reservedStock: Number(material.reservedKg),
        availableStock: Number(material.availableKg),
        dailyConsumptionRate,
        daysRemaining: isFinite(daysRemaining) ? Math.round(daysRemaining * 10) / 10 : 999,
        alertLevel,
        recommendedOrderKg: Math.round(recommendedOrderKg * 10) / 10
      });
    }
  }

  // Sort by urgency (critical first, then warning, then info)
  return alerts.sort((a, b) => {
    const levelOrder = { critical: 0, warning: 1, info: 2 };
    if (a.alertLevel !== b.alertLevel) {
      return levelOrder[a.alertLevel] - levelOrder[b.alertLevel];
    }
    // Within same level, sort by days remaining
    return a.daysRemaining - b.daysRemaining;
  });
}

export async function getStockLevelHistory(materialId: string, days: number = 30) {
  const user = await requireAuth();

  const startDate = subDays(new Date(), days);

  // Get daily stock snapshots (this would need to be implemented with a stock history table in production)
  // For now, return a simple trend based on consumption

  const material = await prisma.rawMaterial.findUnique({
    where: { id: materialId },
    include: {
      receipts: {
        where: { createdAt: { gte: startDate } },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!material) {
    throw new Error('Material not found');
  }

  // Calculate cumulative stock changes
  let currentStock = Number(material.availableKg);
  const history = [];

  // Add current point
  history.push({
    date: new Date().toISOString().split('T')[0],
    stock: currentStock
  });

  // Work backwards through receipts to show stock trend
  const sortedReceipts = material.receipts.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  for (const receipt of sortedReceipts) {
    currentStock -= Number(receipt.kgReceived);
    history.unshift({
      date: receipt.createdAt.toISOString().split('T')[0],
      stock: Math.max(0, currentStock) // Don't go below zero
    });
  }

  return history;
}

export interface ReorderSuggestion {
  materialId: string;
  materialName: string;
  supplierName?: string;
  currentStock: number;
  dailyConsumptionRate: number;
  dailySalesRate: number;
  productionDemand: number;
  suggestedOrderQuantity: number;
  estimatedDaysToDepletion: number;
  reorderPoint: number;
  supplierLeadTime?: number;
}

export async function getReorderSuggestions(): Promise<ReorderSuggestion[]> {
  const user = await requireAuth();

  const thirtyDaysAgo = subDays(new Date(), 30);
  const suggestions: ReorderSuggestion[] = [];

  // Get all raw materials with consumption and sales data
  const materials = await prisma.rawMaterial.findMany({
    include: {
      supplier: true,
      consumptionLogs: {
        where: { consumedAt: { gte: thirtyDaysAgo } }
      },
      bomItems: {
        include: {
          design: {
            include: {
              productionOrders: {
                where: {
                  status: { in: ['PENDING', 'APPROVED', 'IN_PRODUCTION'] }
                }
              },
              finishedGoods: {
                include: {
                  saleItems: {
                    include: {
                      saleOrder: true
                    },
                    where: {
                      saleOrder: {
                        status: 'CONFIRMED',
                        createdAt: { gte: thirtyDaysAgo }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  for (const material of materials) {
    const availableStock = Number(material.availableKg);

    // Calculate production consumption rate
    const totalConsumedKg = material.consumptionLogs.reduce((sum, log) => {
      return sum + Number(log.quantityConsumed);
    }, 0);
    const productionConsumptionRate = totalConsumedKg / 30;

    // Calculate sales rate from finished goods
    let totalSoldKg = 0;
    for (const bomItem of material.bomItems) {
      for (const finishedGood of bomItem.design.finishedGoods) {
        for (const saleItem of finishedGood.saleItems) {
          totalSoldKg += Number(bomItem.quantity) * saleItem.quantity;
        }
      }
    }
    const salesRate = totalSoldKg / 30;

    // Calculate current production demand
    let productionDemand = 0;
    for (const bomItem of material.bomItems) {
      for (const order of bomItem.design.productionOrders) {
        productionDemand += Number(bomItem.quantity) * order.quantity;
      }
    }

    // Calculate combined demand rate
    const combinedDemandRate = productionConsumptionRate + salesRate;

    // Calculate reorder point (demand during lead time + safety stock)
    const leadTimeDays = material.supplier ? 7 : 14; // Default lead times
    const safetyStockDays = 5;
    const reorderPoint = combinedDemandRate * (leadTimeDays + safetyStockDays);

    // Calculate suggested order quantity
    const targetStockDays = 45; // Keep 45 days of stock
    const targetStockLevel = combinedDemandRate * targetStockDays;
    const suggestedOrderQuantity = Math.max(
      targetStockLevel - availableStock,
      combinedDemandRate * 7 // Minimum 1 week supply
    );

    // Calculate days to depletion
    const estimatedDaysToDepletion = combinedDemandRate > 0
      ? availableStock / combinedDemandRate
      : 999;

    // Only suggest reorders if stock is below reorder point or will be depleted soon
    if (availableStock <= reorderPoint || estimatedDaysToDepletion <= 21) {
      suggestions.push({
        materialId: material.id,
        materialName: material.materialName,
        supplierName: material.supplier?.name,
        currentStock: availableStock,
        dailyConsumptionRate: productionConsumptionRate,
        dailySalesRate: salesRate,
        productionDemand,
        suggestedOrderQuantity: Math.round(suggestedOrderQuantity * 10) / 10,
        estimatedDaysToDepletion: Math.round(estimatedDaysToDepletion * 10) / 10,
        reorderPoint: Math.round(reorderPoint * 10) / 10,
        supplierLeadTime: leadTimeDays
      });
    }
  }

  // Sort by urgency (days to depletion)
  return suggestions.sort((a, b) => a.estimatedDaysToDepletion - b.estimatedDaysToDepletion);
}