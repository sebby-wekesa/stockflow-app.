import { NextResponse } from 'next/server'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { getDateRange, toCSV, type DateRangeKey } from '@/lib/reports'

export async function GET(request: Request) {
  const user = await requireActiveAuth()
  if (!['ADMIN', 'MANAGER', 'OPERATOR'].includes(user.role)) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  const db = getTenantPrisma(user.organizationId)

  const { searchParams } = new URL(request.url)
  const range = (searchParams.get('range') as DateRangeKey) || '30d'
  const { start, end } = getDateRange(range)

  // Get completed production orders (tenant scoped)
  const orders = await db.productionOrder.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: start ? { gte: start, lte: end } : undefined,
    },
    include: {
      design: true,
      StageLog: {
        include: {
          Stage: true,
          User: true,
        },
      },
      MaterialConsumptionLog: {
        include: {
          RawMaterial: true,
        },
      },
    },
  })

  const rows = orders.map((order) => {
    const totalKgIn = order.StageLog.reduce((sum: number, log: { kgIn: number | string | { toNumber?: () => number } }) => sum + Number(log.kgIn), 0)
    const totalKgOut = order.StageLog.reduce((sum: number, log: { kgOut: number | string | { toNumber?: () => number } }) => sum + Number(log.kgOut), 0)
    const totalScrap = order.StageLog.reduce((sum: number, log: { kgScrap: number | string | { toNumber?: () => number } }) => sum + Number(log.kgScrap), 0)

    return {
      order_number: order.orderNumber,
      design: order.design?.name || 'Unknown',
      quantity: order.quantity,
      target_kg: order.targetKg,
      completed_at: order.completedAt?.toISOString().slice(0, 10) || '',
      total_kg_in: totalKgIn,
      total_kg_out: totalKgOut,
      total_scrap: totalScrap,
      yield_percentage: totalKgIn > 0 ? ((totalKgOut / totalKgIn) * 100).toFixed(1) + '%' : '0%',
      stages_count: order.StageLog.length,
      last_operator: order.StageLog[order.StageLog.length - 1]?.User?.name || 'Unknown',
    }
  })

  const csv = toCSV(rows, [
    { key: 'order_number', label: 'Order Number' },
    { key: 'design', label: 'Design' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'target_kg', label: 'Target KG' },
    { key: 'completed_at', label: 'Completed Date' },
    { key: 'total_kg_in', label: 'Total KG In' },
    { key: 'total_kg_out', label: 'Total KG Out' },
    { key: 'total_scrap', label: 'Total Scrap KG' },
    { key: 'yield_percentage', label: 'Yield %' },
    { key: 'stages_count', label: 'Stages Count' },
    { key: 'last_operator', label: 'Last Operator' },
  ])

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="production-report-${range}-${today}.csv"`,
    },
  })
}