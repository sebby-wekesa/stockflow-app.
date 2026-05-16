import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'
import { getDateRange, toCSV, type DateRangeKey } from '@/lib/reports'

export async function GET(request: Request) {
  // Auth check
  const supabase = await createServerSupabase()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user || !['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(user.role)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const range = (searchParams.get('range') as DateRangeKey) || '30d'
  const { start } = getDateRange(range)

  // Get raw materials inventory
  const rawMaterials = await prisma.rawMaterial.findMany({
    include: {
      InventoryRawMaterial: {
        include: {
          Branch: true,
        },
      },
    },
  })

  // Get finished goods inventory
  const finishedGoods = await prisma.finishedGoods.findMany({
    include: {
      InventoryFinishedGoods: {
        include: {
          Branch: true,
        },
      },
      Design: true,
    },
  })

  // Flatten raw materials data
  const rawRows = rawMaterials.flatMap((material) =>
    material.InventoryRawMaterial.map((inv) => ({
      type: 'Raw Material',
      sku: material.sku,
      name: material.materialName,
      branch: inv.Branch?.name || 'Unknown',
      available_qty: inv.availableKg,
      reserved_qty: inv.reservedKg,
      total_qty: inv.availableKg + inv.reservedKg,
      uom: 'kg',
      last_updated: inv.updatedAt.toISOString().slice(0, 10),
    }))
  )

  // Flatten finished goods data
  const finishedRows = finishedGoods.flatMap((product) =>
    product.InventoryFinishedGoods.map((inv) => ({
      type: 'Finished Goods',
      sku: product.sku,
      name: product.Design?.name || 'Unknown Design',
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
      'Content-Disposition': `attachment; filename="stock-report-${range}-${today}.csv"`,
    },
  })
}