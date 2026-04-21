// lib/actions/scheduling.ts
import { prisma } from "@/lib/prisma";

export async function getDepartmentLoad() {
  const loadStats = await prisma.productionOrder.groupBy({
    by: ['currentDept'],
    where: {
      status: 'IN_PRODUCTION',
    },
    _count: {
      id: true,
    },
    _sum: {
      targetKg: true,
    },
  });

  return loadStats.filter(stat => stat.currentDept !== null);
}