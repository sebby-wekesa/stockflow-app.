import { prisma } from '@/lib/prisma'
import { Prisma, type Design, type ProductionOrder, type StageLog } from '@prisma/client'

export interface DepartmentBreakdown {
  department: string
  totalIn: number
  totalOut: number
  totalScrap: number
  yieldEfficiency: number
  stageCount: number
}

export interface MonthlyYieldReport {
  totalIn: number
  totalOut: number
  totalScrap: number
  yieldEfficiency: string
  deptBreakdown: DepartmentBreakdown[]
}

type CompletedOrder = ProductionOrder & {
  design: Design
  logs: StageLog[]
}

function toDecimal(value: Prisma.Decimal | number | string | null | undefined) {
  return value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(value ?? 0)
}

function summarizeByDept(logs: StageLog[]): DepartmentBreakdown[] {
  const deptMap = new Map<string, {
    totalIn: Prisma.Decimal
    totalOut: Prisma.Decimal
    totalScrap: Prisma.Decimal
    stageCount: number
  }>()

  logs.forEach(log => {
    const dept = log.department || 'Unknown'
    const current = deptMap.get(dept) || {
      totalIn: new Prisma.Decimal(0),
      totalOut: new Prisma.Decimal(0),
      totalScrap: new Prisma.Decimal(0),
      stageCount: 0
    }

    current.totalIn = current.totalIn.add(toDecimal(log.kgIn))
    current.totalOut = current.totalOut.add(toDecimal(log.kgOut))
    current.totalScrap = current.totalScrap.add(toDecimal(log.kgScrap))
    current.stageCount += 1

    deptMap.set(dept, current)
  })

  return Array.from(deptMap.entries()).map(([department, data]) => ({
    department,
    totalIn: data.totalIn.toNumber(),
    totalOut: data.totalOut.toNumber(),
    totalScrap: data.totalScrap.toNumber(),
    yieldEfficiency: data.totalIn.isZero() ? 0 : data.totalOut.div(data.totalIn).mul(100).toNumber(),
    stageCount: data.stageCount
  })).sort((a, b) => b.yieldEfficiency - a.yieldEfficiency)
}

export async function getMonthlyYieldReport(): Promise<MonthlyYieldReport> {
  const logs = await prisma.stageLog.findMany({
    where: {
      completedAt: {
        gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) // Last 30 days
      }
    }
  })

  // Calculate Aggregates
  const totalIn = logs.reduce((sum, log) => sum.add(toDecimal(log.kgIn)), new Prisma.Decimal(0))
  const totalOut = logs.reduce((sum, log) => sum.add(toDecimal(log.kgOut)), new Prisma.Decimal(0))
  const totalScrap = logs.reduce((sum, log) => sum.add(toDecimal(log.kgScrap)), new Prisma.Decimal(0))

  const yieldEfficiency = totalIn.isZero() ? '0.00' : totalOut.div(totalIn).mul(100).toFixed(2)

  return {
    totalIn: totalIn.toNumber(),
    totalOut: totalOut.toNumber(),
    totalScrap: totalScrap.toNumber(),
    yieldEfficiency,
    // Grouping by department for the chart
    deptBreakdown: summarizeByDept(logs)
  }
}

export async function exportCompletedOrdersCSV(startDate: Date, endDate: Date): Promise<string> {
  const orders = await prisma.productionOrder.findMany({
    where: {
      status: 'COMPLETED',
      updatedAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      Design: true,
      logs: {
        orderBy: {
          sequence: 'asc'
        }
      }
    }
  }) as CompletedOrder[]

  // CSV Header
  let csv = 'Order Number,Design,Start Weight (kg),End Weight (kg),Total Scrap (kg),Yield %,Completion Date\n'

  orders.forEach(order => {
    const startWeight = order.logs.length > 0 ? order.logs[0].kgIn : new Prisma.Decimal(0)
    const endWeight = order.logs.length > 0 ? order.logs[order.logs.length - 1].kgOut : new Prisma.Decimal(0)
    const totalScrap = order.logs.reduce((sum, log) => sum.add(toDecimal(log.kgScrap)), new Prisma.Decimal(0))
    const yieldPercent = startWeight.isZero() ? '0.00' : endWeight.div(startWeight).mul(100).toFixed(2)

    csv += `${order.orderNumber},${order.design.name},${startWeight.toNumber()},${endWeight.toNumber()},${totalScrap.toNumber()},${yieldPercent},${order.updatedAt.toISOString().split('T')[0]}\n`
  })

  return csv
}
