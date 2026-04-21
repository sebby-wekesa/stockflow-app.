'use server'

import { prisma } from '@/lib/prisma'

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

function summarizeByDept(logs: any[]): DepartmentBreakdown[] {
  const deptMap = new Map<string, {
    totalIn: number
    totalOut: number
    totalScrap: number
    stageCount: number
  }>()

  logs.forEach(log => {
    const dept = log.department || 'Unknown'
    const current = deptMap.get(dept) || {
      totalIn: 0,
      totalOut: 0,
      totalScrap: 0,
      stageCount: 0
    }

    current.totalIn += log.kgIn
    current.totalOut += log.kgOut
    current.totalScrap += log.kgScrap
    current.stageCount += 1

    deptMap.set(dept, current)
  })

  return Array.from(deptMap.entries()).map(([department, data]) => ({
    department,
    totalIn: data.totalIn,
    totalOut: data.totalOut,
    totalScrap: data.totalScrap,
    yieldEfficiency: data.totalIn > 0 ? ((data.totalOut / data.totalIn) * 100) : 0,
    stageCount: data.stageCount
  })).sort((a, b) => b.yieldEfficiency - a.yieldEfficiency)
}

export async function getMonthlyYieldReport(): Promise<MonthlyYieldReport> {
  const logs = await prisma.stageLog.findMany({
    where: {
      createdAt: {
        gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) // Last 30 days
      }
    }
  })

  // Calculate Aggregates
  const totalIn = logs.reduce((sum, log) => sum + log.kgIn, 0)
  const totalOut = logs.reduce((sum, log) => sum + log.kgOut, 0)
  const totalScrap = logs.reduce((sum, log) => sum + log.kgScrap, 0)

  const yieldEfficiency = totalIn > 0 ? ((totalOut / totalIn) * 100).toFixed(2) : '0.00'

  return {
    totalIn,
    totalOut,
    totalScrap,
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
      design: true,
      logs: {
        orderBy: {
          sequence: 'asc'
        }
      }
    }
  })

  // CSV Header
  let csv = 'Order Number,Design,Start Weight (kg),End Weight (kg),Total Scrap (kg),Yield %,Completion Date\n'

  orders.forEach(order => {
    const startWeight = order.logs.length > 0 ? order.logs[0].kgIn : 0
    const endWeight = order.logs.length > 0 ? order.logs[order.logs.length - 1].kgOut : 0
    const totalScrap = order.logs.reduce((sum, log) => sum + log.kgScrap, 0)
    const yieldPercent = startWeight > 0 ? ((endWeight / startWeight) * 100).toFixed(2) : '0.00'

    csv += `${order.orderNumber},${order.design.name},${startWeight},${endWeight},${totalScrap},${yieldPercent},${order.updatedAt.toISOString().split('T')[0]}\n`
  })

  return csv
}