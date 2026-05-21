"use server";

import { startOfDay, startOfWeek } from "date-fns";
import { requireAuth } from "@/lib/auth";
import type { AuthUser, Role } from "@/lib/auth";
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { Prisma, type Design, type ProductionOrder, type RawMaterial, type StageLog } from '@prisma/client';

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

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  return value?.toNumber() ?? 0;
}

export async function getDashboardStats(user?: AuthUser, role?: Role) {
  const authUser = user || await requireAuth();
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

  // 1. Raw Material Stock - Everyone can see, but Warehouse sees more detail
  let materials: RawMaterial[] = []
  try {
    materials = await prisma.rawMaterial.findMany();
  } catch (error) {
    console.warn('Failed to fetch raw materials:', error)
    materials = []
  }
  const rawMaterialStock = materials.reduce(
    (sum, m) => sum + toNumber(m.availableKg) + toNumber(m.reservedKg),
    0
  );
  const totalFree = materials.reduce(
    (sum, m) => sum + toNumber(m.availableKg),
    0
  );

  // 2. Active Orders - Filter based on role
  let activeOrdersWhere: any = {};
  let pendingApprovalsWhere: any = {};

  if (isOperator) {
    // Operators only see orders in their department
    activeOrdersWhere = {
      status: { in: ["APPROVED", "IN_PRODUCTION"] },
      currentDept: authUser.department,
    };
    pendingApprovalsWhere = {
      status: "PENDING",
      // Operators don't see pending approvals
    };
  } else if (isWarehouse) {
    // Warehouse staff only see basic counts, no order details
    activeOrdersWhere = {};
    pendingApprovalsWhere = {};
  } else if (isSales) {
    // Sales see minimal production info
    activeOrdersWhere = {};
    pendingApprovalsWhere = {};
  } else {
    // Admin/Manager see all
    activeOrdersWhere = {
      status: { in: ["APPROVED", "IN_PRODUCTION"] },
    };
    pendingApprovalsWhere = {
      status: "PENDING",
    };
  }

  let activeOrdersCount = 0
  try {
    activeOrdersCount = await prisma.productionOrder.count({
      where: activeOrdersWhere,
    });
  } catch (error) {
    console.warn('Failed to count active orders:', error)
    activeOrdersCount = 0
  }
  let pendingApprovalsCount = isOperator || isWarehouse || isSales ? 0 : 0
  if (!isOperator && !isWarehouse && !isSales) {
    try {
      pendingApprovalsCount = await prisma.productionOrder.count({
        where: pendingApprovalsWhere,
      });
    } catch (error) {
      console.warn('Failed to count pending approvals:', error)
      pendingApprovalsCount = 0
    }
  }

  // 3. Finished Goods - Everyone can see basic counts
  let finishedGoods: { _sum: { kgProduced: number | null, quantity: number | null } } = { _sum: { kgProduced: null, quantity: null } }
  try {
    const aggResult = await prisma.finishedGoods.aggregate({
      _sum: {
        kgProduced: true,
        quantity: true,
      },
    });
    finishedGoods = {
      _sum: {
        kgProduced: aggResult._sum.kgProduced?.toNumber() ?? null,
        quantity: aggResult._sum.quantity ?? null,
      }
    };
  } catch (error) {
    console.warn('Failed to aggregate finished goods:', error)
    finishedGoods = { _sum: { kgProduced: 0, quantity: 0 } }
  }

  // 4. Scrap This Week - Only Admin/Manager see scrap data
  let scrapThisWeek = 0;
  if (isAdmin || isManager) {
    let weeklyLogs: StageLog[] = []
    try {
      weeklyLogs = await prisma.stageLog.findMany({
        where: {
          completedAt: {
            gte: weekStart,
          },
        },
      });
    } catch (error) {
      console.warn('Failed to fetch weekly logs for scrap:', error)
      weeklyLogs = []
    }
    scrapThisWeek = weeklyLogs.reduce((sum, log) => sum + log.kgScrap.toNumber(), 0);
  }

  // 5. Recent Orders - Filter based on role
  let recentOrdersWhere: any = {};
  if (isOperator) {
    recentOrdersWhere = {
      currentDept: authUser.department,
    };
  } else if (isWarehouse || isSales) {
    // Warehouse and Sales see limited or no order details
    recentOrdersWhere = {}; // Will return empty array below
  }

  let recentOrders: (ProductionOrder & { design: Design })[] = []
  if (!(isWarehouse || isSales)) {
    try {
      recentOrders = await prisma.productionOrder.findMany({
        take: 4,
        where: recentOrdersWhere,
        orderBy: {
          updatedAt: "desc",
        },
        include: {
          design: true,
        },
      });
    } catch (error) {
      console.warn('Failed to fetch recent orders:', error)
      recentOrders = []
    }
  }

  // 6. Department Metrics (Scrap & Throughput) - Only Admin/Manager see detailed metrics
  let departmentScrap: DepartmentScrap[] = [];
  let throughput: Throughput[] = [];

  if (isAdmin || isManager) {
    let weeklyLogs: StageLog[] = []
    try {
      weeklyLogs = await prisma.stageLog.findMany({
        where: {
          completedAt: {
            gte: weekStart,
          },
        },
      });
    } catch (error) {
      console.warn('Failed to fetch weekly logs for department scrap:', error)
      weeklyLogs = []
    }

    // Group weekly logs by dept for scrap chart
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

  if (isAdmin || isManager || isOperator) {
    let todayLogs: StageLog[] = []
    try {
      todayLogs = await prisma.stageLog.findMany({
        where: {
          completedAt: {
            gte: todayStart,
          },
          ...(isOperator && authUser.department ? { department: authUser.department } : {}),
        },
      });
    } catch (error) {
      console.warn('Failed to fetch today logs for throughput:', error)
      todayLogs = []
    }

    // Group today's logs for throughput
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
        sub: `${materials.length} materials · ${totalFree} kg free`,
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
        sub: `${finishedGoods._sum.quantity || 0} units available`,
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
        sub: `${materials.length} materials · ${totalFree} kg free`,
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
      design: o.design.name,
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

export async function getManagerData() {
  let pendingApprovals: any[] = []
  try {
    pendingApprovals = await prisma.productionOrder.findMany({
      where: { status: 'PENDING' },
      include: { design: true },
    });
  } catch (error) {
    console.warn('Failed to fetch pending approvals:', error)
    pendingApprovals = []
  }

  let activeProduction: any[] = []
  try {
    const grouped = await prisma.productionOrder.groupBy({
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
    allLogs = await prisma.stageLog.findMany({
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
    totalActiveOrders = await prisma.productionOrder.count({
      where: { status: { in: ['APPROVED', 'IN_PRODUCTION'] } },
    });
  } catch (error) {
    console.warn('Failed to count total active orders:', error)
    totalActiveOrders = 0
  }

  let totalTonnageAgg: { _sum: { targetKg: number | null } } = { _sum: { targetKg: 0 } }
  try {
    const aggResult = await prisma.productionOrder.aggregate({
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

export async function approveOrder(orderId: string) {
  let order
  try {
    order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        design: {
          include: {
            stages: {
              orderBy: { sequence: 'asc' }
            },
            billOfMaterials: {
              include: { RawMaterial: true }
            }
          }
        }
      },
    });
  } catch (error) {
    console.warn('Failed to find order:', error)
    throw new Error('Database error: Could not find order')
  }

  if (!order || order.status !== 'PENDING') {
    throw new Error('Invalid order');
  }

  if (!order.design.billOfMaterials || order.design.billOfMaterials.length === 0) {
    throw new Error('No raw materials assigned to design');
  }

  const firstStage = order.design.stages[0];
  if (!firstStage) {
    throw new Error('Design has no production stages configured');
  }

  // For now, assume single raw material per design (take first BOM item)
  const primaryBomItem = order.design.billOfMaterials[0];
  const plannedUnits =
    order.design.targetWeight && order.design.targetWeight.gt(0)
      ? order.targetKg.toNumber() / order.design.targetWeight.toNumber()
      : order.quantity;
  const reserveQuantity = plannedUnits * primaryBomItem.quantity.toNumber();

  let material
  try {
    material = await prisma.rawMaterial.findUnique({
      where: { id: primaryBomItem.rawMaterialId },
    });
  } catch (error) {
    console.warn('Failed to find raw material:', error)
    throw new Error('Database error: Could not find raw material')
  }

  if (!material || material.availableKg.toNumber() < reserveQuantity) {
    throw new Error('Insufficient stock');
  }

  await prisma.rawMaterial.update({
    where: { id: material.id },
    data: {
      availableKg: material.availableKg.toNumber() - reserveQuantity,
      reservedKg: material.reservedKg.toNumber() + reserveQuantity,
    },
  });

  await prisma.productionOrder.update({
    where: { id: orderId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      currentStage: firstStage.sequence,
      currentDept: firstStage.department,
    },
  });

  revalidatePath('/manager');
}
