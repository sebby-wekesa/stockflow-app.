// lib/actions/analytics.ts
import { prisma } from "@/lib/prisma";

export async function getScrapStats() {
  const stats = await prisma.stageLog.groupBy({
    by: ['department'],
    _sum: {
      kgScrap: true,
      kgIn: true,
    },
  });

  return stats.map(stat => ({
    department: stat.department || "Unknown",
    totalScrap: stat._sum.kgScrap || 0,
    yieldPercentage: stat._sum.kgIn 
      ? ((stat._sum.kgIn - (stat._sum.kgScrap || 0)) / stat._sum.kgIn) * 100 
      : 0
  }));
}