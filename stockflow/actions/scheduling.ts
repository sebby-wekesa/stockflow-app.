"use server";

import { prisma } from "@/lib/prisma";

export async function getDepartmentLoad() {
  const load = await prisma.productionOrder.groupBy({
    by: ['currentDept'],
    where: {
      status: "IN_PRODUCTION",
      currentDept: { not: null },
    },
    _sum: {
      targetKg: true,
    },
    _count: {
      id: true,
    },
  });

  return load;
}