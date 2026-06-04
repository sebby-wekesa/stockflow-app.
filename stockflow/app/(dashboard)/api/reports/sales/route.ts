import { NextResponse } from 'next/server'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { getDateRange, toCSV, type DateRangeKey } from '@/lib/reports'

export async function GET(request: Request) {
  const user = await requireActiveAuth()
  if (!['ADMIN', 'MANAGER', 'SALES'].includes(user.role.toUpperCase())) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  const db = getTenantPrisma(user.organizationId)

  const { searchParams } = new URL(request.url)
  const range = (searchParams.get('range') as DateRangeKey) || '30d'
  const { start, end } = getDateRange(range)

   const orders = await db.saleOrder.findMany({
     where: {
       status: { in: ['CONFIRMED', 'READY_FOR_DISPATCH', 'SHIPPED'] },
       ...(start ? { createdAt: { gte: start, lte: end } } : {}),
     },
     orderBy: { createdAt: 'desc' },
     include: {
       SaleItem: { include: { FinishedGoods: { include: { design: true } } } },
       createdByUser: {
         select: {
           name: true,
           Branch: { select: { name: true } },
         },
       },
     },
   })

  // Flatten to one row per line item
  const rows = orders.flatMap((order) =>
    order.SaleItem.map((line) => ({
      invoice_date: new Date(order.createdAt).toISOString().slice(0, 10),
      invoice_number: order.id,
      branch: order.createdByUser?.Branch?.name ?? 'Unassigned',
      customer: order.customerName,
      product_code: line.FinishedGoods.sku,
      product_name: line.FinishedGoods.design.name,
      qty: line.quantity,
      uom: 'pcs',
      unit_price: Number(line.unitPrice),
      total: Number(line.totalPrice),
      notes: '',
      recorded_by: order.createdByUser?.name ?? 'System',
    }))
  )

  const csv = toCSV(rows, [
    { key: 'invoice_date', label: 'Invoice date' },
    { key: 'invoice_number', label: 'Invoice number' },
    { key: 'branch', label: 'Branch' },
    { key: 'customer', label: 'Customer' },
    { key: 'product_code', label: 'Product code' },
    { key: 'product_name', label: 'Product name' },
    { key: 'qty', label: 'Quantity' },
    { key: 'uom', label: 'UOM' },
    { key: 'unit_price', label: 'Unit price' },
    { key: 'total', label: 'Total amount' },
    { key: 'notes', label: 'Notes' },
    { key: 'recorded_by', label: 'Recorded by' },
  ])

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sales-${range}-${today}.csv"`,
    },
  })
}
