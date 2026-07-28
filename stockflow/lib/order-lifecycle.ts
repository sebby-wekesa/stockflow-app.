type TransactionClient = any

type SaleOrderWithItems = {
  id: string
  status: string
  SaleItem: Array<{
    finishedGoodsId: string
    quantity: number
    piecesSets?: number
    unitPrice?: unknown
    totalPrice?: unknown
    FinishedGoods?: { sku: string; quantity: number; reservedQuantity: number }
  }>
}

export function getSaleItemPiecesSets(
  item: Pick<SaleOrderWithItems['SaleItem'][number], 'piecesSets' | 'unitPrice' | 'totalPrice'>
) {
  const piecesSets = Number(item.piecesSets)
  if (Number.isFinite(piecesSets) && piecesSets > 0) return piecesSets

  // Older SaleItem rows predate the dedicated piecesSets column. Preserve
  // their billable quantity when they are fulfilled or cancelled.
  const unitPrice = Number(item.unitPrice)
  return unitPrice > 0 ? Number(item.totalPrice) / unitPrice : 0
}

async function findSaleProduct(
  tx: TransactionClient,
  item: SaleOrderWithItems['SaleItem'][number],
  organizationId?: string,
) {
  const sku = item.FinishedGoods?.sku
  if (!sku || !tx.product?.findFirst) return null

  return tx.product.findFirst({
    where: {
      OR: [{ sku }, { id: sku }],
      ...(organizationId ? { organizationId } : {}),
    },
    select: { id: true, sku: true },
  })
}

async function findSaleMovement(
  tx: TransactionClient,
  orderId: string,
  productId: string,
  organizationId?: string,
) {
  if (!tx.stockMovement?.findFirst) return null

  return tx.stockMovement.findFirst({
    where: {
      productId,
      reference: orderId,
      movementType: 'sale',
      ...(organizationId ? { organizationId } : {}),
    },
    select: { id: true },
  })
}

async function decrementProductPiecesForSale(
  tx: TransactionClient,
  order: SaleOrderWithItems,
  item: SaleOrderWithItems['SaleItem'][number],
  organizationId?: string,
) {
  const product = await findSaleProduct(tx, item, organizationId)
  if (!product) return false

  const piecesSets = getSaleItemPiecesSets(item)
  const decremented = await tx.product.updateMany({
    where: {
      id: product.id,
      ...(organizationId ? { organizationId } : {}),
      piecesSets: { gte: piecesSets },
    },
    data: {
      piecesSets: { decrement: piecesSets },
    },
  })

  if (decremented.count === 0) {
    throw new Error(
      `Product pieces/sets stock is inconsistent for ${item.FinishedGoods?.sku ?? 'sale item'}`
    )
  }

  if (tx.stockMovement?.create) {
    await tx.stockMovement.create({
      data: {
        ...(organizationId ? { organizationId } : {}),
        productId: product.id,
        movementType: 'sale',
        quantity: 0,
        piecesSets: -piecesSets,
        reference: order.id,
        notes: `Sale to ${order.id} · ${piecesSets} pcs/sets`,
      },
    })
  }

  return true
}

export async function reserveSaleOrder(
  tx: TransactionClient,
  order: SaleOrderWithItems,
  organizationId?: string,
) {
  if (order.status !== 'PENDING') {
    throw new Error('Only pending sales orders can be confirmed')
  }

  for (const item of order.SaleItem) {
    const reserved = await tx.finishedGoods.updateMany({
      where: {
        id: item.finishedGoodsId,
        quantity: { gte: item.quantity },
      },
      data: {
        quantity: { decrement: item.quantity },
        reservedQuantity: { increment: item.quantity },
      },
    })

    if (reserved.count === 0) {
      throw new Error(
        `Insufficient available finished goods for ${item.FinishedGoods?.sku ?? 'sale item'}`
      )
    }

    // Product pcs/sets are committed to the sale immediately. Product kg is
    // consumed later by the production operation that records the kg input.
    await decrementProductPiecesForSale(tx, order, item, organizationId)
  }

  return tx.saleOrder.update({
    where: { id: order.id },
    data: { status: 'CONFIRMED' },
  })
}

export async function releaseSaleOrderReservation(
  tx: TransactionClient,
  order: SaleOrderWithItems,
  organizationId?: string,
) {
  if (order.status !== 'CONFIRMED') return

  for (const item of order.SaleItem) {
    const released = await tx.finishedGoods.updateMany({
      where: {
        id: item.finishedGoodsId,
        reservedQuantity: { gte: item.quantity },
      },
      data: {
        quantity: { increment: item.quantity },
        reservedQuantity: { decrement: item.quantity },
      },
    })

    if (released.count === 0) {
      throw new Error(
        `Reserved finished goods are inconsistent for ${item.FinishedGoods?.sku ?? 'sale item'}`
      )
    }

    const product = await findSaleProduct(tx, item, organizationId)
    if (!product) continue

    // Only restore stock that this confirmation actually consumed. This keeps
    // cancellations of legacy confirmed orders from inflating product stock.
    const saleMovement = await findSaleMovement(tx, order.id, product.id, organizationId)
    if (!saleMovement) continue

    const piecesSets = getSaleItemPiecesSets(item)
    await tx.product.updateMany({
      where: {
        id: product.id,
        ...(organizationId ? { organizationId } : {}),
      },
      data: {
        piecesSets: { increment: piecesSets },
      },
    })

    if (tx.stockMovement?.create) {
      await tx.stockMovement.create({
        data: {
          ...(organizationId ? { organizationId } : {}),
          productId: product.id,
          movementType: 'sale_reversal',
          quantity: 0,
          piecesSets,
          reference: order.id,
          notes: `Cancelled sale ${order.id} · restored ${piecesSets} pcs/sets`,
        },
      })
    }
  }
}

export async function consumeSaleOrderReservation(tx: TransactionClient, order: SaleOrderWithItems) {
  if (order.status !== 'CONFIRMED') {
    throw new Error('Only confirmed sales orders can be fulfilled')
  }

  for (const item of order.SaleItem) {
    const consumed = await tx.finishedGoods.updateMany({
      where: {
        id: item.finishedGoodsId,
        reservedQuantity: { gte: item.quantity },
      },
      data: {
        reservedQuantity: { decrement: item.quantity },
      },
    })

    if (consumed.count === 0) {
      throw new Error(
        `Reserved finished goods are inconsistent for ${item.FinishedGoods?.sku ?? 'sale item'}`
      )
    }
  }
}

export async function incrementProductShadowStock(
  tx: TransactionClient,
  sku: string | null,
  quantity: number
) {
  if (!sku) return
  await tx.finishedGoods.updateMany({
    where: { sku },
    data: { quantity: { increment: Math.floor(quantity) } },
  })
}

export async function syncProductShadowStock(
  tx: TransactionClient,
  oldSku: string | null,
  newSku: string | null,
  totalStock: number
) {
  if (!oldSku) return
  const shadow = await tx.finishedGoods.findFirst({ where: { sku: oldSku } })
  if (!shadow) return

  const available = Math.floor(totalStock) - shadow.reservedQuantity
  if (available < 0) {
    throw new Error('Product stock cannot be adjusted below its reserved quantity')
  }

  await tx.finishedGoods.update({
    where: { id: shadow.id },
    data: {
      sku: newSku ?? oldSku,
      quantity: available,
    },
  })
}
