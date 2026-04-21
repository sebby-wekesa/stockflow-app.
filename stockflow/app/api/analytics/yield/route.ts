export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  try {
    await requireRole("ADMIN");

    // --- 1. Department Yield Stats (grouped by department) ---
    // Note: We use stageName field for grouping as requested.
    const deptAgg = await prisma.stageLog.groupBy({
      by: ["stageName"],
      _sum: { kgIn: true, kgOut: true, kgScrap: true },
      orderBy: { stageName: "asc" },
    });

    const departmentStats = deptAgg.map((d) => {
      const kgIn = d._sum.kgIn ?? 0;
      const kgOut = d._sum.kgOut ?? 0;
      const kgScrap = d._sum.kgScrap ?? 0;
      const yieldPct = kgIn > 0 ? +((kgOut / kgIn) * 100).toFixed(2) : 0;
      return { 
        department: d.stageName || "Unspecified", // Fallback
        kgIn, 
        kgOut, 
        kgScrap, 
        yieldPct 
      };
    });

    // --- 2. Global KPIs ---
    const totals = departmentStats.reduce(
      (acc, d) => ({
        kgIn: acc.kgIn + d.kgIn,
        kgOut: acc.kgOut + d.kgOut,
        kgScrap: acc.kgScrap + d.kgScrap,
      }),
      { kgIn: 0, kgOut: 0, kgScrap: 0 }
    );
    const globalYield =
      totals.kgIn > 0 ? +((totals.kgOut / totals.kgIn) * 100).toFixed(2) : 0;

    // --- 3. Scrap Reason Distribution ---
    const scrapReasonAgg = await prisma.stageLog.groupBy({
      by: ["scrapReason"],
      _sum: { kgScrap: true },
      where: { kgScrap: { gt: 0 } },
      orderBy: { _sum: { kgScrap: "desc" } },
    });

    const scrapDistribution = scrapReasonAgg.map((s) => ({
      reason: s.scrapReason ?? "Other",
      kgScrap: s._sum.kgScrap ?? 0,
    }));

    // --- 4. WIP (Work In Progress) ---
    const wipOrders = await prisma.productionOrder.findMany({
      where: { status: "IN_PRODUCTION" },
      select: { currentDept: true, targetKg: true, id: true, logs: { select: { kgScrap: true } } },
    });

    const wipMap: Record<string, { kgRemaining: number; orderCount: number }> = {};
    for (const order of wipOrders) {
      const dept = order.currentDept || "Awaiting Start";
      const totalScrapSoFar = order.logs.reduce((s, l) => s + l.kgScrap, 0);
      const kgRemaining = Math.max(0, order.targetKg - totalScrapSoFar);
      if (!wipMap[dept]) wipMap[dept] = { kgRemaining: 0, orderCount: 0 };
      wipMap[dept].kgRemaining += kgRemaining;
      wipMap[dept].orderCount += 1;
    }

    const wip = Object.entries(wipMap).map(([dept, v]) => ({
      department: dept,
      kgRemaining: +v.kgRemaining.toFixed(2),
      orderCount: v.orderCount,
    }));

    return NextResponse.json({
      globalYield,
      totals,
      departmentStats,
      scrapDistribution,
      wip,
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || error?.message === "Forbidden: Insufficient permissions") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[analytics/yield] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
