"use server";

import { startOfDay, startOfWeek } from "date-fns";
import { requireActiveAuth } from "@/lib/auth";
import type { AuthUser, Role } from "@/lib/auth";
import { revalidatePath } from 'next/cache';
import { getTenantPrisma } from '@/lib/tenant-prisma';
import { Prisma, type Design, type ProductionOrder, type RawMaterial, type StageLog } from '@prisma/client';
import { updateOrderStatus } from '@/app/actions/orders';

interface Stat {
  label: string;
  value: number;
  suffix?: string;
  sub: string;
  down?: boolean;
  color: string;
}

interface DepartmentScrap {
  dept: string;
  kg: number;
  pct: number;
}

interface Throughput {
  dept: string;
  jobs: number;
  kg: number;
  scrap: number;
  ops: number;
  yield: number;
}

type StageLogWithOrder = StageLog & {
  ProductionOrder: ProductionOrder;
}

type FinishedGoodsAggregate = {
  _sum: {
    kgProduced: Prisma.Decimal | null;
    quantity: number | null;
  };
};

type PendingApproval = ProductionOrder & {
  design: Design | null;
};

type ActiveProductionSummary = {
  currentDept: string | null;
  _count: {
    _all: number;
  };
  _sum: {
    targetKg: number | null;
  };
};

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  return value?.toNumber() ?? 0;
}

const DEFAULT_DASHBOARD_QUERY_BATCH_SIZE = 3;
const MAX_DASHBOARD_QUERY_BATCH_SIZE = 10;

function getDashboardQueryBatchSize(value: string | undefined) {
  if (!value) return DEFAULT_DASHBOARD_QUERY_BATCH_SIZE;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.warn(
      `Invalid DB_QUERY_BATCH_SIZE="${value}". Falling back to ${DEFAULT_DASHBOARD_QUERY_BATCH_SIZE}.`
    );
    return DEFAULT_DASHBOARD_QUERY_BATCH_SIZE;
  }

  return Math.min(Math.floor(parsed), MAX_DASHBOARD_QUERY_BATCH_SIZE);
}

export async function getDashboardStats(user?: AuthUser, role?: Role) {
  const authUser = user || await requireActiveAuth();
  const db = getTenantPrisma(authUser.organizationId);
  const effectiveRole = role || authUser.role;
  const now = new Date();
  const weekStart = startOfWeek(now);
  const todayStart = startOfDay(now);

  // Role-based data filtering
  const isAdmin = effectiveRole === "ADMIN";
  const isManager = effectiveRole === "MANAGER";
  const isOperator = effectiveRole === "OPERATOR";
  const isWarehouse = effectiveRole === "WAREHOUSE";
  const isSales = effectiveRole === "SALES";

  // 2. Active Orders - Filter based on role (compute the where clauses up front
  //    so we can use them in the parallel fetch below)
  let activeOrdersWhere: Prisma.ProductionOrderWhereInput = {};
  let pendingApprovalsWhere: Prisma.ProductionOrderWhereInput = {};

  if (isOperator) {
    activeOrdersWhere = {
      status: { in: ["APPROVED", "IN_PRODUCTION"] },
      currentDept: authUser.department,
    };
    pendingApprovalsWhere = { status: "PENDING" };
  } else if (isWarehouse) {
    activeOrdersWhere = {};
    pendingApprovalsWhere = {};
  } else if (isSales) {
    activeOrdersWhere = {};
    pendingApprovalsWhere = {};
  } else {
    activeOrdersWhere = { status: { in: ["APPROVED", "IN_PRODUCTION"] } };
    pendingApprovalsWhere = { status: "PENDING" };
  }

  // 5. Recent Orders - Filter based on role
  let recentOrdersWhere: Prisma.ProductionOrderWhereInput = {};
  if (isOperator) {
    recentOrdersWhere = { currentDept: authUser.department };
  } else if (isWarehouse || isSales) {
    recentOrdersWhere = {};
  }

  const fetchPendingApprovals = !isOperator && !isWarehouse && !isSales;
  const fetchScrapAndDeptMetrics = isAdmin || isManager;
  const fetchTodayThroughput = isAdmin || isManager || isOperator;
  const fetchRecentOrders = !(isWarehouse || isSales);

  // ─── PARALLEL FETCH ─────────────────────────────────────────────────────────
  // Run independent queries in small batches to avoid bursting DB pooler
  async function runBatches<T>(tasks: Array<() => Promise<T>>, batchSize = 3): Promise<T[]> {
    const results: T[] = []
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize).map((fn) => fn())
      const res = await Promise.all(batch)
      results.push(...res)
    }
    return results
  }

  const queryTasks: Array<() => Promise<unknown>> = [
    () => db.rawMaterial.findMany().catch((e) => { console.warn('Failed to fetch raw materials:', e); return [] as RawMaterial[]; }),
    () => db.productionOrder.count({ where: activeOrdersWhere }).catch((e) => { console.warn('Failed to count active orders:', e); return 0; }),
    () => (fetchPendingApprovals
      ? db.productionOrder.count({ where: pendingApprovalsWhere }).catch((e) => { console.warn('Failed to count pending approvals:', e); return 0; })
      : Promise.resolve(0)),
    () => db.finishedGoods.aggregate({ _sum: { kgProduced: true, quantity: true } }).catch((e) => { console.warn('Failed to aggregate finished goods:', e); return { _sum: { kgProduced: null, quantity: null } }; }),
    () => (fetchScrapAndDeptMetrics
      ? db.stageLog.findMany({ where: { completedAt: { gte: weekStart } } }).catch((e) => { console.warn('Failed to fetch weekly logs:', e); return [] as StageLog[]; })
      : Promise.resolve([] as StageLog[])),
    () => (fetchRecentOrders
      ? db.productionOrder.findMany({
          take: 4,
          where: recentOrdersWhere,
          orderBy: { updatedAt: "desc" },
          include: { design: true },
        }).catch((e) => { console.warn('Failed to fetch recent orders:', e); return [] as (ProductionOrder & { design: Design })[]; })
      : Promise.resolve([] as (ProductionOrder & { design: Design })[])),
    () => (fetchTodayThroughput
      ? db.stageLog.findMany({
          where: {
            completedAt: { gte: todayStart },
            ...(isOperator && authUser.department ? { department: authUser.department } : {}),
          },
        }).catch((e) => { console.warn('Failed to fetch today logs:', e); return [] as StageLog[]; })
      : Promise.resolve([] as StageLog[])),
  ]

  const [
    materials,
    activeOrdersCountRaw,
    pendingApprovalsCountRaw,
    finishedGoodsAggRaw,
    weeklyLogsRaw,
    recentOrdersRaw,
    todayLogsRaw,
  ] = await runBatches(queryTasks, getDashboardQueryBatchSize(process.env.DB_QUERY_BATCH_SIZE));

  const materialsTyped = materials as RawMaterial[];
  const activeOrdersCount = activeOrdersCountRaw as number;
  const pendingApprovalsCount = pendingApprovalsCountRaw as number;
  const finishedGoodsAgg = finishedGoodsAggRaw as FinishedGoodsAggregate;
  const weeklyLogs = weeklyLogsRaw as StageLog[];
  const recentOrders = recentOrdersRaw as (ProductionOrder & { design: Design })[];
  const todayLogs = todayLogsRaw as StageLog[];

  // 1. Raw Material totals (in-memory, no DB)
  const rawMaterialStock = materialsTyped.reduce(
    (sum, m) => sum + toNumber(m.availableKg) + toNumber(m.reservedKg),
    0
  );
  const totalFree = materialsTyped.reduce(
    (sum, m) => sum + toNumber(m.availableKg),
    0
  );

  // 3. Finished Goods totals (already aggregated above)
  const finishedGoods = {
    _sum: {
      kgProduced: finishedGoodsAgg._sum.kgProduced?.toNumber() ?? null,
      quantity: finishedGoodsAgg._sum.quantity ?? null,
    }
  };

  // 4. Scrap This Week (reuses weeklyLogs)
  let scrapThisWeek = 0;
  if (fetchScrapAndDeptMetrics) {
    scrapThisWeek = weeklyLogs.reduce((sum, log) => sum + log.kgScrap.toNumber(), 0);
  }

  // 6. Department Metrics — Scrap (reuses weeklyLogs again, no extra query)
  let departmentScrap: DepartmentScrap[] = [];
  let throughput: Throughput[] = [];

  if (fetchScrapAndDeptMetrics) {
    const deptScrapMap: Record<string, number> = {};
    weeklyLogs.forEach(log => {
      const dept = log.department || "Unknown";
      deptScrapMap[dept] = (deptScrapMap[dept] || 0) + toNumber(log.kgScrap);
    });

    const totalScrap = weeklyLogs.reduce((sum, log) => sum + toNumber(log.kgScrap), 0);
    departmentScrap = Object.entries(deptScrapMap).map(([dept, kg]) => {
      const pct = totalScrap > 0 ? Math.round((kg / totalScrap) * 100) : 0;
      return { dept, kg, pct };
    });
  }

  // 7. Today's Throughput (uses todayLogs from the parallel fetch)
  if (fetchTodayThroughput) {
    const throughputMap: Record<string, { dept: string; jobs: Set<string>; kg: number; scrap: number; ops: Set<string> }> = {};
    todayLogs.forEach(log => {
      const dept = log.department || "Unknown";
      if (!throughputMap[dept]) {
        throughputMap[dept] = { dept, jobs: new Set(), kg: 0, scrap: 0, ops: new Set() };
      }
      throughputMap[dept].jobs.add(log.orderId);
      throughputMap[dept].kg += toNumber(log.kgOut);
      throughputMap[dept].scrap += toNumber(log.kgScrap);
      throughputMap[dept].ops.add(log.operatorId);
    });

    throughput = Object.entries(throughputMap).map(([dept, data]) => {
      const totalProcessed = data.kg + data.scrap;
      const yield_pct = totalProcessed > 0 ? (data.kg / totalProcessed) * 100 : 0;
      return {
        dept,
        jobs: data.jobs.size,
        kg: data.kg,
        scrap: data.scrap,
        yield: parseFloat(yield_pct.toFixed(1)),
        ops: data.ops.size,
      };
    });
  }

  // Build stats array based on role
  let stats: Stat[] = [];

  if (isWarehouse) {
    // Warehouse sees inventory-focused stats
    stats = [
      {
        label: 'Raw material stock',
        value: rawMaterialStock,
        suffix: 'kg',
        sub: `${materialsTyped.length} materials · ${totalFree} kg free`,
        color: 'amber'
      },
      {
        label: 'Active production orders',
        value: activeOrdersCount,
        sub: 'Orders requiring materials',
        color: 'teal'
      }
    ];
  } else if (isOperator) {
    // Operators see department-focused stats
    stats = [
      {
        label: 'My department queue',
        value: activeOrdersCount,
        sub: 'Jobs ready for processing',
        color: 'purple'
      },
      {
        label: 'Today\'s throughput',
        value: throughput.find(t => t.dept === authUser.department)?.kg || 0,
        suffix: 'kg',
        sub: 'Processed in my department',
        color: 'teal'
      }
    ];
  } else if (isSales) {
    // Sales see sales-focused stats
    stats = [
      {
        label: 'Finished goods ready',
        value: finishedGoods._sum.kgProduced || 0,
        suffix: 'kg',
        sub: `${finishedGoods._sum.quantity || 0} kg available`,
        color: 'purple'
      },
      {
        label: 'Active sales orders',
        value: 0, // Would need sales order count
        sub: 'Orders being fulfilled',
        color: 'teal'
      }
    ];
  } else {
    // Admin/Manager see full overview
    stats = [
      {
        label: 'Raw material stock',
        value: rawMaterialStock,
        suffix: 'kg',
        sub: `${materialsTyped.length} materials · ${totalFree} kg free`,
        color: 'amber'
      },
      {
        label: 'Active production orders',
        value: activeOrdersCount,
        sub: `${pendingApprovalsCount} pending approval · ${activeOrdersCount - pendingApprovalsCount} in production`,
        color: 'teal'
      },
      {
        label: 'Finished goods ready',
        value: finishedGoods._sum.kgProduced || 0,
        suffix: 'kg',
        sub: `${finishedGoods._sum.quantity || 0} units across designs`,
        color: 'purple'
      },
      {
        label: 'Scrap this week',
        value: scrapThisWeek,
        suffix: 'kg',
        sub: '↑ vs last week', // Simplified
        down: true,
        color: 'red'
      },
    ];
  }

  return {
    stats,
    recentOrders: recentOrders.map(o => ({
      id: o.orderNumber,
      design: o.design?.name ?? o.productName ?? 'Direct order',
      kg: toNumber(o.targetKg),
      status: o.status === "PENDING" ? "Pending approval" :
              o.status === "APPROVED" || o.status === "IN_PRODUCTION" ? "In production" : "Complete",
      dept: o.currentDept,
    })),
    departmentScrap,
    throughput,
    userRole: authUser.role,
    userDepartment: authUser.department,
  };
}

export async function approveOrder(orderId: string) {
  const result = await updateOrderStatus(orderId, 'APPROVED');
  if (!result.success) throw new Error(result.error);
  revalidatePath('/manager');
  revalidatePath('/dashboard');
  revalidatePath('/approvals');
  revalidatePath('/jobs');
  revalidatePath('/admin/approvals');
  return result;
}

// Server Action wrapper for <form action=> usage
export async function approveOrderAction(formData: FormData) {
  const orderId = String(formData.get('orderId') ?? '')
  if (!orderId) throw new Error('Invalid order id')
  await approveOrder(orderId)
}

export async function getManagerData() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  let pendingApprovals: PendingApproval[] = []
  try {
    pendingApprovals = await db.productionOrder.findMany({
      where: { status: 'PENDING' },
      include: { design: true },
    });
  } catch (error) {
    console.warn('Failed to fetch pending approvals:', error)
    pendingApprovals = []
  }

  let activeProduction: ActiveProductionSummary[] = []
  try {
    const grouped = await db.productionOrder.groupBy({
      by: ['currentDept'],
      where: { status: { in: ['APPROVED', 'IN_PRODUCTION'] } },
      _count: { _all: true },
      _sum: { targetKg: true },
    });
    activeProduction = grouped.map(g => ({
      currentDept: g.currentDept,
      _count: g._count,
      _sum: {
        targetKg: g._sum.targetKg ? g._sum.targetKg.toNumber() : null,
      },
    }));
  } catch (error) {
    console.warn('Failed to group active production:', error)
    activeProduction = []
  }

  let allLogs: StageLogWithOrder[] = []
  try {
    allLogs = await db.stageLog.findMany({
      where: { kgScrap: { gt: 0 } },
      include: { ProductionOrder: true },
    });
  } catch (error) {
    console.warn('Failed to fetch scrap logs:', error)
    allLogs = []
  }
  const scrapAlerts = allLogs.filter(log => toNumber(log.kgScrap) > toNumber(log.kgIn) * 0.05);

  let totalActiveOrders = 0
  try {
    totalActiveOrders = await db.productionOrder.count({
      where: { status: { in: ['APPROVED', 'IN_PRODUCTION'] } },
    });
  } catch (error) {
    console.warn('Failed to count total active orders:', error)
    totalActiveOrders = 0
  }

  let totalTonnageAgg: { _sum: { targetKg: number | null } } = { _sum: { targetKg: 0 } }
  try {
    const aggResult = await db.productionOrder.aggregate({
      where: { status: { in: ['APPROVED', 'IN_PRODUCTION'] } },
      _sum: { targetKg: true },
    });
    totalTonnageAgg = {
      _sum: {
        targetKg: aggResult._sum.targetKg?.toNumber() ?? 0
      }
    };
  } catch (error) {
    console.warn('Failed to aggregate total tonnage:', error)
    totalTonnageAgg = { _sum: { targetKg: 0 } }
  }

  const pendingCount = pendingApprovals.length;

  return {
    pendingApprovals,
    activeProduction,
    scrapAlerts,
    totalActiveOrders,
    totalTonnage: totalTonnageAgg._sum.targetKg || 0,
    pendingCount,
  };
}
