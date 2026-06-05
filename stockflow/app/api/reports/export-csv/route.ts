export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getTenantPrisma } from '@/lib/tenant-prisma';
import { requireActiveAuth } from '@/lib/auth';

export interface MonthlyYieldReport {
  departments: DepartmentBreakdown[];
  globalMetrics: GlobalMetrics;
}

export interface DepartmentBreakdown {
  department: string;
  totalIn: number;
  totalOut: number;
  totalScrap: number;
  yieldEfficiency: number;
  stageCount: number;
}

export interface GlobalMetrics {
  totalInput: number;
  totalOutput: number;
  totalScrap: number;
  overallYield: number;
  departmentCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireActiveAuth();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getTenantPrisma(user.organizationId);

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const startDate = startDateParam ? new Date(startDateParam) : (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return d;
    })();

    const endDate = endDateParam ? new Date(endDateParam) : new Date();

    // Fetch completed orders within the date range (tenant scoped)
    const completedOrders = await db.productionOrder.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        design: true,
      },
      orderBy: { completedAt: 'desc' },
    });

    if (completedOrders.length === 0) {
      return new NextResponse('No completed orders found in the specified date range.', { status: 404 });
    }

    // Generate CSV
    const csvHeaders = [
      'Order ID',
      'Design Name',
      'Target Weight (kg)',
      'Completed At',
      'Department'
    ].join(',');

    const csvRows = completedOrders.map(order =>
      [
        order.id,
        `"${order.design?.name ?? order.productName ?? 'Direct order'}"`,
        Number(order.targetKg),
        order.completedAt?.toISOString().split('T')[0] || '',
        order.currentDept || ''
      ].join(',')
    );

    const csv = [csvHeaders, ...csvRows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="completed-orders-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Forbidden: Insufficient permissions') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[api/reports/export-csv] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
