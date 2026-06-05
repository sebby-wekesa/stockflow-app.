import { NextResponse } from 'next/server'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { toCSV } from '@/lib/reports'

export async function GET() {
  const user = await requireActiveAuth()
  if (!['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(user.role)) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  const db = getTenantPrisma(user.organizationId)

  // Get raw materials inventory (tenant scoped)
  const rawMaterials = await db.rawMaterial.findMany({
    include: {
      InventoryRawMaterial: {
        include: {
          Branch: true,
        },
      },
    },
  })

  // Get finished goods inventory
  const finishedGoods = await db.finishedGoods.findMany({
    include: {
      InventoryFinishedGoods: {
        include: {
          Branch: true,
        },
      },
      design: true,
    },
  })

  // Flatten raw materials data
  const rawRows = rawMaterials.flatMap((material) =>
    material.InventoryRawMaterial.map((inv) => ({
      type: 'Raw Material',
      sku: material.sku,
      name: material.materialName,
      branch: inv.Branch?.name || 'Unknown',
      available_qty: inv.availableKg?.toNumber() ?? 0,
      reserved_qty: inv.reservedKg?.toNumber() ?? 0,
      total_qty: (inv.availableKg?.toNumber() ?? 0) + (inv.reservedKg?.toNumber() ?? 0),
      uom: 'kg',
      last_updated: inv.updatedAt.toISOString().slice(0, 10),
    }))
  )

  // Flatten finished goods data
  const finishedRows = finishedGoods.flatMap((product) =>
    product.InventoryFinishedGoods.map((inv) => ({
      type: 'Finished Goods',
      sku: product.sku,
      name: product.design?.name || 'Unknown Design',
      branch: inv.Branch?.name || 'Unknown',
      available_qty: inv.availableQty,
      reserved_qty: 0, // Not tracked yet
      total_qty: inv.availableQty,
      uom: 'pcs',
      last_updated: inv.updatedAt.toISOString().slice(0, 10),
    }))
  )

  const rows = [...rawRows, ...finishedRows]

  const csv = toCSV(rows, [
    { key: 'type', label: 'Type' },
    { key: 'sku', label: 'SKU' },
    { key: 'name', label: 'Name' },
    { key: 'branch', label: 'Branch' },
    { key: 'available_qty', label: 'Available Qty' },
    { key: 'reserved_qty', label: 'Reserved Qty' },
    { key: 'total_qty', label: 'Total Qty' },
    { key: 'uom', label: 'UOM' },
    { key: 'last_updated', label: 'Last Updated' },
  ])

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="stock-report-${today}.csv"`,
    },
  })
}
