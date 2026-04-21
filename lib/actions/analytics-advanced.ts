"use server";

import { prisma } from "@/lib/prisma";

export async function getScrapRootCauses() {
  const data = await prisma.stageLog.groupBy({
    by: ['scrapReason'],
    _sum: {
      kgScrap: true
    },
    where: {
      kgScrap: { gt: 0 }
    }
  });

  return data.map(item => ({
    reason: item.scrapReason || "Uncategorized",
    weight: item._sum.kgScrap || 0
  }));
}